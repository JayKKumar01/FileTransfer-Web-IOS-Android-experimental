import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";
import { isApple } from "../utils/osUtil";
import { crc32 } from "../utils/zipUtil";

const CHUNK_SIZE = 256 * 1024; // 256 KB
const APPLE_BUFFER_SIZE = 4 * 1024 * 1024; // 4 MB for iOS/macOS (fixed comment)
const DEFAULT_BUFFER_SIZE = 8 * 1024 * 1024; // 8 MB for Android/others
const BUFFER_SIZE = isApple() ? APPLE_BUFFER_SIZE : DEFAULT_BUFFER_SIZE;

const UPS = 3; // UI updates per second
const UI_UPDATE_INTERVAL = 1000 / UPS;

export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileRef = useRef(null);
    const isSendingRef = useRef(false);
    const uiThrottleRef = useRef(0);

    // -------------------- Refill buffer --------------------
    const refillBuffer = async (file) => {
        const remaining = file.metadata.size - file._fileOffset;
        if (remaining <= 0) return false;

        const size = Math.min(BUFFER_SIZE, remaining);
        file._buffer = await file.file
            .slice(file._fileOffset, file._fileOffset + size)
            .arrayBuffer();

        file._bufferOffset = 0;
        file._fileOffset += size;
        file._buffer.byteLengthUsed = file._buffer.byteLength;

        return true;
    };

    // -------------------- Send one chunk --------------------
    const sendChunk = async () => {
        const file = currentFileRef.current;
        if (!file || !connection) return;

        if (!file._buffer || file._bufferOffset >= file._buffer.byteLengthUsed) {
            const hasMore = await refillBuffer(file);
            if (!hasMore) return;
        }

        const remaining = file._buffer.byteLengthUsed - file._bufferOffset;
        const size = Math.min(CHUNK_SIZE, remaining);
        const chunkBuffer = file._buffer.slice(
            file._bufferOffset,
            file._bufferOffset + size
        );

        file.crc = file.crc || 0;
        file.crc = crc32(file.crc, new Uint8Array(chunkBuffer));

        file._bufferOffset += size;

        const chunkIndex = Math.floor(file._bytesSent / CHUNK_SIZE);
        file._bytesSent += size;

        const isLastChunk = file._bytesSent >= file.metadata.size;

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
        // attach transfer state directly to file object
        file._bytesSent = 0;
        file._speed = { lastTime: performance.now(), lastTotal: 0 };
        file._buffer = null;
        file._bufferOffset = 0;
        file._fileOffset = 0;

        currentFileRef.current = file;
        isSendingRef.current = true;
        uiThrottleRef.current = 0;

        updateFile(file.id, { state: "sending", progress: 0, speed: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}"`);

        sendChunk().catch(console.error);
    };

    // -------------------- Finish transfer --------------------
    const finishFile = () => {
        const file = currentFileRef.current;
        if (!file) return;

        updateFile(file.id, {
            state: "sent",
            progress: file.metadata.size,
            speed: 0,
        });

        // clear refs
        currentFileRef.current = null;
        isSendingRef.current = false;

        console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
    };

    // -------------------- ACK handling --------------------
    const processAck = (ack) => {
        const file = currentFileRef.current;
        if (!file || ack.fileId !== file.id) return;

        if (file._bytesSent >= file.metadata.size) {
            finishFile();
            return;
        }

        sendChunk().catch(console.error);

        // Throttle UI updates
        const now = performance.now();
        if (now - uiThrottleRef.current >= UI_UPDATE_INTERVAL) {
            const delta = (now - file._speed.lastTime) / 1000;
            const sentSinceLast = file._bytesSent - (file._speed.lastTotal || 0);
            const speed = delta > 0 ? sentSinceLast / delta : 0;

            const progressPercent = Math.floor(
                (file._bytesSent / file.metadata.size) * 100
            );
            const speedRounded = Math.round(speed);

            if (
                progressPercent !== file.lastProgress ||
                speedRounded !== file.lastSpeed
            ) {
                updateFile(file.id, { progress: file._bytesSent, speed });
                file.lastProgress = progressPercent;
                file.lastSpeed = speedRounded;
            }

            file._speed.lastTime = now;
            file._speed.lastTotal = file._bytesSent;
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
