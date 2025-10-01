import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";
import {isApple} from "../utils/osUtil";

const CHUNK_SIZE = 256 * 1024; // 256 KB

const APPLE_BUFFER_SIZE = 2 * 1024 * 1024; // 2 MB for iOS/macOS
const DEFAULT_BUFFER_SIZE = 8 * 1024 * 1024;   // 8 MB for Android/others
const BUFFER_SIZE = isApple() ? APPLE_BUFFER_SIZE : DEFAULT_BUFFER_SIZE;

const UPS = 6; // UI updates per second
const UI_UPDATE_INTERVAL = 1000 / UPS;

export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const bytesSentRef = useRef(0);
    const uiThrottleRef = useRef(0);
    const speedRef = useRef({ lastTime: performance.now(), lastTotal: 0 });

    // Android buffer refs
    const bufferRef = useRef(null);
    const bufferOffsetRef = useRef(0);
    const fileOffsetRef = useRef(0);

    // -------------------- Android buffer refill --------------------
    const refillBuffer = async (file) => {
        const remaining = file.size - fileOffsetRef.current;
        if (remaining <= 0) return false;

        const size = Math.min(BUFFER_SIZE, remaining);
        const slice = file.slice(fileOffsetRef.current, fileOffsetRef.current + size);
        const arrayBuffer = await slice.arrayBuffer();
        bufferRef.current = new Uint8Array(arrayBuffer);
        bufferOffsetRef.current = 0;
        fileOffsetRef.current += size;
        return true;
    };


    // -------------------- Send next chunk --------------------
    const sendNextChunk = async () => {
        const file = currentFileRef.current;
        if (!file || !connection) return;

        if (!bufferRef.current || bufferOffsetRef.current >= bufferRef.current.length) {
            const hasMore = await refillBuffer(file.file);
            if (!hasMore) return;
        }

        const remaining = bufferRef.current.length - bufferOffsetRef.current;
        const size = Math.min(CHUNK_SIZE, remaining);
        const chunk = bufferRef.current.subarray(bufferOffsetRef.current, bufferOffsetRef.current + size);
        bufferOffsetRef.current += size;

        connection.send({
            type: "chunk",
            fileId: file.id,
            chunkIndex: Math.floor(bytesSentRef.current / CHUNK_SIZE),
            data: chunk,
        });

        bytesSentRef.current += chunk.byteLength;
    };


    // -------------------- Start / Finish --------------------
    const startFileTransfer = (file) => {
        currentFileRef.current = file;
        isSendingRef.current = true;
        bytesSentRef.current = 0;
        uiThrottleRef.current = 0;
        speedRef.current = { lastTime: performance.now(), lastTotal: 0 };
        bufferRef.current = null;
        bufferOffsetRef.current = 0;
        fileOffsetRef.current = 0;

        updateFile(file.id, { state: "sending", progress: 0, speed: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}"`);

        sendNextChunk();
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

        console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
    };

    // -------------------- ACK handling --------------------
    const processAck = (ack) => {
        const file = currentFileRef.current;
        if (!file || ack.fileId !== file.id) return;

        // -------------------- Completion check --------------------
        if (bytesSentRef.current >= file.metadata.size) {
            finishFile();
            return;
        }

        // -------------------- Send next chunk immediately --------------------
        sendNextChunk();

        // -------------------- Throttled UI update with correct speed --------------------
        const now = performance.now();
        if (now - uiThrottleRef.current >= UI_UPDATE_INTERVAL) {
            const delta = (now - speedRef.current.lastTime) / 1000;
            const sentSinceLast = bytesSentRef.current - (speedRef.current.lastTotal || 0);
            const speed = delta > 0 ? sentSinceLast / delta : 0;

            speedRef.current.lastTime = now;
            speedRef.current.lastTotal = bytesSentRef.current;
            uiThrottleRef.current = now;

            updateFile(file.id, { progress: bytesSentRef.current, speed });
        }
    };

    // -------------------- Effects --------------------
    useEffect(() => {
        if (!isConnectionReady || isSendingRef.current) return;
        const nextFile = files.find(f => f.status.state === "pending");
        if (nextFile) startFileTransfer(nextFile);
    }, [files, isConnectionReady]);

    useEffect(() => {
        if (!connection) return;
        const handleData = (data) => { if (data.type === "ack") processAck(data); };
        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, files]);
};
