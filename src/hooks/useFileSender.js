import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

const MIN_CHUNK_SIZE = 64 * 1024; // 64 KB
const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_BUFFER_SIZE = 2 * 1024 * 1024; // 2 MB buffer
const GROWTH_FACTOR = 1.25;
const SHRINK_FACTOR = 0.8;
const SPEED_HISTORY_COUNT = 5; // last N chunk speeds

// -------------------- Global UI update config --------------------
const UPS = 6; // updates per second
const UI_UPDATE_INTERVAL = 1000 / UPS; // milliseconds

export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    // ---------------- Refs ----------------
    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const bytesSentRef = useRef(0);

    const bufferRef = useRef(null);
    const bufferOffsetRef = useRef(0);
    const fileOffsetRef = useRef(0);

    const dynamicChunkSizeRef = useRef(MIN_CHUNK_SIZE);
    const chunkCountRef = useRef(0);

    const speedHistoryRef = useRef([]);
    const speedRef = useRef({ lastTime: performance.now() });
    const uiThrottleRef = useRef(0);

    const sendingLockRef = useRef(false);

    // ---------------- Buffering ----------------
    const refillBuffer = async (file) => {
        const remaining = file.file.size - fileOffsetRef.current;
        if (remaining <= 0) return false;

        const bufferSize = Math.min(MAX_BUFFER_SIZE, remaining);
        const slice = file.file.slice(fileOffsetRef.current, fileOffsetRef.current + bufferSize);
        bufferRef.current = await slice.arrayBuffer();
        bufferOffsetRef.current = 0;
        fileOffsetRef.current += bufferSize;
        return true;
    };

    const getNextChunk = async (file) => {
        if (!bufferRef.current || bufferOffsetRef.current >= bufferRef.current.byteLength) {
            const hasMore = await refillBuffer(file);
            if (!hasMore) return null;
        }

        const remaining = bufferRef.current.byteLength - bufferOffsetRef.current;
        const size = Math.min(dynamicChunkSizeRef.current, remaining);
        const chunk = bufferRef.current.slice(bufferOffsetRef.current, bufferOffsetRef.current + size);
        bufferOffsetRef.current += size;
        return chunk;
    };

    // ---------------- Dynamic chunk size ----------------
    const updateDynamicChunkSize = (chunkSize, deltaTime) => {
        if (deltaTime <= 0) return;

        const speed = chunkSize / deltaTime;
        const history = speedHistoryRef.current;
        history.push(speed);
        if (history.length > SPEED_HISTORY_COUNT) history.shift();

        const avgSpeed = history.reduce((a, b) => a + b, 0) / history.length;

        if (speed > avgSpeed) {
            dynamicChunkSizeRef.current = Math.min(dynamicChunkSizeRef.current * GROWTH_FACTOR, MAX_CHUNK_SIZE);
        } else {
            dynamicChunkSizeRef.current = Math.max(dynamicChunkSizeRef.current * SHRINK_FACTOR, MIN_CHUNK_SIZE);
        }
    };

    // ---------------- Send chunk ----------------
    const sendChunk = async (file) => {
        if (sendingLockRef.current) return;
        sendingLockRef.current = true;

        const data = await getNextChunk(file);
        if (!data) {
            sendingLockRef.current = false;
            return;
        }

        const now = performance.now();
        const delta = (now - speedRef.current.lastTime) / 1000 || 0.001;

        updateDynamicChunkSize(data.byteLength, delta);
        speedRef.current.lastTime = now;

        connection.send({
            type: "chunk",
            fileId: file.id,
            chunkIndex: chunkCountRef.current++,
            data
        });

        bytesSentRef.current += data.byteLength;

        // UI update
        const uiNow = performance.now();
        if (uiNow - uiThrottleRef.current >= UI_UPDATE_INTERVAL) {
            const speed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
            updateFile(file.id, { progress: bytesSentRef.current, speed });
            uiThrottleRef.current = uiNow;
        }

        sendingLockRef.current = false;
    };

    // ---------------- Start / Finish ----------------
    const startFileTransfer = (file) => {
        currentFileRef.current = file;
        isSendingRef.current = true;
        bytesSentRef.current = 0;
        fileOffsetRef.current = 0;
        bufferRef.current = null;
        bufferOffsetRef.current = 0;
        dynamicChunkSizeRef.current = MIN_CHUNK_SIZE;
        chunkCountRef.current = 0;
        speedHistoryRef.current = [];
        speedRef.current = { lastTime: performance.now() };
        uiThrottleRef.current = 0;
        sendingLockRef.current = false;

        updateFile(file.id, { state: "sending", progress: 0, speed: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}"`);

        sendChunk(file);
    };

    const finishFile = () => {
        const file = currentFileRef.current;
        if (!file) return;

        updateFile(file.id, { state: "sent", progress: file.metadata.size, speed: 0 });

        currentFileRef.current = null;
        isSendingRef.current = false;
        bytesSentRef.current = 0;
        bufferRef.current = null;
        bufferOffsetRef.current = 0;
        fileOffsetRef.current = 0;
        chunkCountRef.current = 0;
        speedHistoryRef.current = [];
        sendingLockRef.current = false;

        console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
    };

    // ---------------- Process ACK ----------------
    const processAck = async (ack) => {
        if (!currentFileRef.current || ack.fileId !== currentFileRef.current.id) return;

        if (bytesSentRef.current >= currentFileRef.current.metadata.size) finishFile();
        else await sendChunk(currentFileRef.current);
    };

    // ---------------- Effects ----------------
    useEffect(() => {
        if (!isConnectionReady || isSendingRef.current) return;
        const nextFile = files.find(f => f.status.state === "pending");
        if (nextFile) startFileTransfer(nextFile);
    }, [files, isConnectionReady]);

    useEffect(() => {
        if (!connection) return;
        const handleData = (data) => {
            if (data.type === "ack") processAck(data);
        };
        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, files]);
};
