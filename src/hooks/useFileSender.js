import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";
import { isApple } from "../utils/osUtil";
import { crc32 } from "../utils/zipUtil";

const CHUNK_SIZE = 256 * 1024; // 256 KB
const APPLE_BUFFER_SIZE = 4 * 1024 * 1024; // 2 MB for iOS/macOS
const DEFAULT_BUFFER_SIZE = 8 * 1024 * 1024; // 8 MB for Android/others
const BUFFER_SIZE = isApple() ? APPLE_BUFFER_SIZE : DEFAULT_BUFFER_SIZE;

const UPS = 3; // UI updates per second
const UI_UPDATE_INTERVAL = 1000 / UPS;

// -------------------- Utility to read a slice as ArrayBuffer --------------------
const readFileSlice = (file, start, end) =>
    new Promise((resolve, reject) => {
        const slice = file.slice(start, end);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(slice);
    });

export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const bytesSentRef = useRef(0);
    const uiThrottleRef = useRef(0);
    const speedRef = useRef({ lastTime: performance.now(), lastTotal: 0 });

    const bufferRef = useRef(null);
    const bufferOffsetRef = useRef(0);
    const fileOffsetRef = useRef(0);

    // -------------------- Refill buffer --------------------
    const refillBuffer = async (file) => {
        const remaining = file.size - fileOffsetRef.current;
        if (remaining <= 0) return false;

        const size = Math.min(BUFFER_SIZE, remaining);
        // bufferRef.current = await readFileSlice(file, fileOffsetRef.current, fileOffsetRef.current + size); // if android then filereader otherwise flie.slice
        bufferRef.current = await file.slice(fileOffsetRef.current, fileOffsetRef.current + size).arrayBuffer();
        bufferOffsetRef.current = 0;
        fileOffsetRef.current += size;
        bufferRef.current.byteLengthUsed = bufferRef.current.byteLength;

        return true;
    };

    // -------------------- Send one chunk --------------------
    const sendChunk = async () => {
        const file = currentFileRef.current;
        if (!file || !connection) return;

        if (!bufferRef.current || bufferOffsetRef.current >= bufferRef.current.byteLengthUsed) {
            const hasMore = await refillBuffer(file.file);
            if (!hasMore) return;
        }

        const remaining = bufferRef.current.byteLengthUsed - bufferOffsetRef.current;
        const size = Math.min(CHUNK_SIZE, remaining);
        const chunkBuffer = bufferRef.current.slice(bufferOffsetRef.current, bufferOffsetRef.current + size);

        file.crc = file.crc || 0;
        file.crc = crc32(file.crc, new Uint8Array(chunkBuffer));

        bufferOffsetRef.current += size;

        const chunkIndex = Math.floor(bytesSentRef.current / CHUNK_SIZE);
        bytesSentRef.current += size;

        const isLastChunk = bytesSentRef.current >= file.metadata.size;

        connection.send({
            type: "chunk",
            fileId: file.id,
            chunkIndex,
            data: chunkBuffer,
            crc: isLastChunk ? file.crc >>> 0 : undefined,
        });
    };

    // -------------------- Start transfer --------------------
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

        sendChunk().catch(console.error);
    };

    // -------------------- Finish transfer --------------------
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

        if (bytesSentRef.current >= file.metadata.size) {
            finishFile();
            return;
        }

        sendChunk().catch(console.error);

        // Throttle UI updates
        const now = performance.now();
        if (now - uiThrottleRef.current >= UI_UPDATE_INTERVAL) {
            const delta = (now - speedRef.current.lastTime) / 1000;
            const sentSinceLast = bytesSentRef.current - (speedRef.current.lastTotal || 0);
            const speed = delta > 0 ? sentSinceLast / delta : 0;

            const progressPercent = Math.floor((bytesSentRef.current / file.metadata.size) * 100);
            const speedRounded = Math.round(speed);

            if (progressPercent !== file.lastProgress || speedRounded !== file.lastSpeed) {
                updateFile(file.id, { progress: bytesSentRef.current, speed });
                file.lastProgress = progressPercent;
                file.lastSpeed = speedRounded;
            }

            speedRef.current.lastTime = now;
            speedRef.current.lastTotal = bytesSentRef.current;
            uiThrottleRef.current = now;
        }
    };

    // -------------------- Effects --------------------
    useEffect(() => {
        if (!isConnectionReady || isSendingRef.current) return;
        const nextFile = files.find((f) => f.status.state === "waiting");
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
