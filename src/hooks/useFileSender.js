import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

const CHUNK_SIZE = 256 * 1024; // 256 KB
const MAX_BUFFER_SIZE = 8 * 1024 * 1024; // 8 MB
const IS_ANDROID = /Android/i.test(navigator.userAgent);

/**
 * Hook to handle sequential file sending with ack-based flow.
 * Optimized for Android using a large buffer to reduce UI blocking.
 */
export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const bytesSentRef = useRef(0);

    // Android buffer
    const largeDataRef = useRef(null);
    const largeDataOffsetRef = useRef(0);
    const currentFilePositionRef = useRef(0);

    // -------------------- Refill buffer (Android) --------------------
    const refillBuffer = async (file) => {
        const remaining = file.file.size - currentFilePositionRef.current;
        if (remaining <= 0) return false;

        const bufferSize = Math.min(MAX_BUFFER_SIZE, remaining);
        const slice = file.file.slice(
            currentFilePositionRef.current,
            currentFilePositionRef.current + bufferSize
        );
        largeDataRef.current = await slice.arrayBuffer();
        largeDataOffsetRef.current = 0;
        currentFilePositionRef.current += bufferSize;
        return true;
    };

    // -------------------- Get next chunk (Unified) --------------------
    const getNextChunk = async (file) => {
        if (!IS_ANDROID) {
            const start = bytesSentRef.current;
            const end = Math.min(start + CHUNK_SIZE, file.file.size);
            const chunk = file.file.slice(start, end);
            return chunk.arrayBuffer();
        }

        if (!largeDataRef.current || largeDataOffsetRef.current >= largeDataRef.current.byteLength) {
            const hasMore = await refillBuffer(file);
            if (!hasMore) return null;
        }

        const remaining = largeDataRef.current.byteLength - largeDataOffsetRef.current;
        const size = Math.min(CHUNK_SIZE, remaining);
        const chunk = largeDataRef.current.slice(
            largeDataOffsetRef.current,
            largeDataOffsetRef.current + size
        );
        largeDataOffsetRef.current += size;
        return chunk;
    };

    // -------------------- Send a chunk (Unified) --------------------
    const sendChunk = async (file) => {
        const data = await getNextChunk(file);
        if (!data) return;

        const chunkIndex = Math.floor(bytesSentRef.current / CHUNK_SIZE);
        connection.send({ type: "chunk", fileId: file.id, chunkIndex, data });
        bytesSentRef.current += data.byteLength;
    };

    // -------------------- Start file transfer --------------------
    const startFileTransfer = (file) => {
        currentFileRef.current = file;
        isSendingRef.current = true;
        bytesSentRef.current = 0;

        if (IS_ANDROID) {
            largeDataRef.current = null;
            largeDataOffsetRef.current = 0;
            currentFilePositionRef.current = 0;
        }

        console.log(`📤 Starting file transfer: "${file.metadata.name}" (ID: ${file.id})`);
        sendChunk(file);
    };

    // -------------------- Finish file --------------------
    const finishFile = () => {
        const file = currentFileRef.current;
        if (!file) return;

        updateFile(file.id, { state: "sent", progress: file.metadata.size });

        currentFileRef.current = null;
        isSendingRef.current = false;
        bytesSentRef.current = 0;

        if (IS_ANDROID) {
            largeDataRef.current = null;
            largeDataOffsetRef.current = 0;
            currentFilePositionRef.current = 0;
        }

        console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
    };

    // -------------------- Handle ACK --------------------
    const processAck = (ack) => {
        if (!currentFileRef.current || ack.fileId !== currentFileRef.current.id) return;

        if (bytesSentRef.current >= currentFileRef.current.metadata.size) {
            finishFile();
        } else {
            updateFile(currentFileRef.current.id, { progress: bytesSentRef.current });
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
