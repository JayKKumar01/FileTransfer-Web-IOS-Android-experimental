import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

const CHUNK_SIZE = 256 * 1024; // 256 KB

// Detect iOS at runtime
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Pick buffer size based on platform
const MAX_BUFFER_SIZE = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

/**
 * Hook to handle sequential file sending with ack-based flow.
 * Uses a large-buffer approach with platform-aware sizing.
 */
export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const bytesSentRef = useRef(0);

    // Unified buffer state
    const bufferRef = useRef(null);
    const bufferOffsetRef = useRef(0);
    const fileOffsetRef = useRef(0);

    // Speed tracking
    const speedRef = useRef({ lastSent: 0, lastTime: 0 });

    // -------------------- Refill buffer --------------------
    const refillBuffer = async (file) => {
        const remaining = file.file.size - fileOffsetRef.current;
        if (remaining <= 0) return false;

        const bufferSize = Math.min(MAX_BUFFER_SIZE, remaining);
        const slice = file.file.slice(
            fileOffsetRef.current,
            fileOffsetRef.current + bufferSize
        );
        bufferRef.current = await slice.arrayBuffer();
        bufferOffsetRef.current = 0;
        fileOffsetRef.current += bufferSize;
        return true;
    };

    // -------------------- Get next chunk --------------------
    const getNextChunk = async (file) => {
        if (!bufferRef.current || bufferOffsetRef.current >= bufferRef.current.byteLength) {
            const hasMore = await refillBuffer(file);
            if (!hasMore) return null;
        }

        const remaining = bufferRef.current.byteLength - bufferOffsetRef.current;
        const size = Math.min(CHUNK_SIZE, remaining);
        const chunk = bufferRef.current.slice(
            bufferOffsetRef.current,
            bufferOffsetRef.current + size
        );
        bufferOffsetRef.current += size;
        return chunk;
    };

    // -------------------- Send a chunk --------------------
    const sendChunk = async (file) => {
        const data = await getNextChunk(file);
        if (!data) return;

        const chunkIndex = Math.floor(bytesSentRef.current / CHUNK_SIZE);

        // mark send time for speed tracking
        speedRef.current.lastSent = data.byteLength;
        speedRef.current.lastTime = performance.now();

        connection.send({ type: "chunk", fileId: file.id, chunkIndex, data });
        bytesSentRef.current += data.byteLength;
    };

    // -------------------- Start file transfer --------------------
    const startFileTransfer = (file) => {
        currentFileRef.current = file;
        isSendingRef.current = true;
        bytesSentRef.current = 0;

        bufferRef.current = null;
        bufferOffsetRef.current = 0;
        fileOffsetRef.current = 0;
        speedRef.current = { lastSent: 0, lastTime: 0 };

        updateFile(file.id, { state: "sending", progress: 0, speed: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}" (buffer=${MAX_BUFFER_SIZE / 1024 / 1024}MB)`);

        sendChunk(file);
    };

    // -------------------- Finish file --------------------
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

    // -------------------- Handle ACK --------------------
    const processAck = (ack) => {
        if (!currentFileRef.current || ack.fileId !== currentFileRef.current.id) return;
        // calculate speed = bytes / timeDelta
        let speed = 0;
        if (speedRef.current.lastSent && speedRef.current.lastTime) {
            const delta = (performance.now() - speedRef.current.lastTime) / 1000; // seconds
            if (delta > 0) {
                speed = speedRef.current.lastSent / delta; // bytes per second
            }
        }

        if (bytesSentRef.current >= currentFileRef.current.metadata.size) {
            finishFile();
        } else {
            updateFile(currentFileRef.current.id, { progress: bytesSentRef.current, speed });
            sendChunk(currentFileRef.current);
        }
    };

    // -------------------- Pick next pending file --------------------
    useEffect(() => {
        if (!isConnectionReady || isSendingRef.current) return;

        const nextFile = files.find(f => f.status.state === "pending");
        if (nextFile) startFileTransfer(nextFile);
    }, [files, isConnectionReady]);

    // -------------------- Handle incoming ACK --------------------
    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (data.type === "ack") processAck(data);
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, files]);
};
