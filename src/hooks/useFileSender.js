import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";
import {isApple} from "../utils/osUtil";

const CHUNK_SIZE = 256 * 1024; // 256 KB
const MAX_BUFFER_SIZE = isApple() ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

// -------------------- Global UI update config --------------------
const UPS = 6; // updates per second
const UI_UPDATE_INTERVAL = 1000 / UPS; // milliseconds

export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const bytesSentRef = useRef(0);

    const bufferRef = useRef(null);
    const bufferOffsetRef = useRef(0);
    const fileOffsetRef = useRef(0);

    const speedRef = useRef({ lastSent: 0, lastTime: 0 });
    const uiThrottleRef = useRef(0); // timestamp of last UI update

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
        const size = Math.min(CHUNK_SIZE, remaining);
        const chunk = bufferRef.current.slice(bufferOffsetRef.current, bufferOffsetRef.current + size);
        bufferOffsetRef.current += size;
        return chunk;
    };

    const sendChunk = async (file) => {
        const data = await getNextChunk(file);
        if (!data) return;

        speedRef.current.lastSent = data.byteLength;
        speedRef.current.lastTime = performance.now();

        connection.send({ type: "chunk", fileId: file.id, chunkIndex: Math.floor(bytesSentRef.current / CHUNK_SIZE), data });
        bytesSentRef.current += data.byteLength;
    };

    const startFileTransfer = (file) => {
        currentFileRef.current = file;
        isSendingRef.current = true;
        bytesSentRef.current = 0;

        bufferRef.current = null;
        bufferOffsetRef.current = 0;
        fileOffsetRef.current = 0;
        speedRef.current = { lastSent: 0, lastTime: 0 };
        uiThrottleRef.current = 0;

        updateFile(file.id, { state: "sending", progress: 0, speed: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}" (buffer=${MAX_BUFFER_SIZE / 1024 / 1024}MB)`);

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

        console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
    };

    const processAck = (ack) => {
        if (!currentFileRef.current || ack.fileId !== currentFileRef.current.id) return;

        let speed = 0;
        if (speedRef.current.lastSent && speedRef.current.lastTime) {
            const delta = (performance.now() - speedRef.current.lastTime) / 1000;
            if (delta > 0) speed = speedRef.current.lastSent / delta;
        }

        if (bytesSentRef.current >= currentFileRef.current.metadata.size) {
            finishFile();
        } else {
            const now = performance.now();
            if (now - uiThrottleRef.current >= UI_UPDATE_INTERVAL) {
                updateFile(currentFileRef.current.id, { progress: bytesSentRef.current, speed });
                uiThrottleRef.current = now;
            }
            sendChunk(currentFileRef.current);
        }
    };

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
