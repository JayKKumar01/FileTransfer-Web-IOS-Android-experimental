import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

/**
 * Hook to handle receiving file chunks, updating progress, speed, and completion.
 * Optimized: uses a single large Uint8Array buffer per file and flushes to Blob at threshold.
 */
export const useFileReceiver = (downloads, updateDownload) => {
    const { connection } = usePeer();

    const bytesReceivedRef = useRef({});
    const speedRef = useRef({});
    const uiThrottleRef = useRef({});
    const downloadMapRef = useRef({});
    const bufferRef = useRef({});     // large Uint8Array per file
    const bufferOffsetRef = useRef({}); // current write offset
    const blobPartsRef = useRef({});  // finalized blobs

    const UPS = 6;
    const UI_UPDATE_INTERVAL = 1000 / UPS;

    // Platform-specific buffer threshold
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const BUFFER_THRESHOLD = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024; // 2MB / 8MB

    const initRefs = (fileId, totalSize) => {
        if (!bytesReceivedRef.current[fileId]) bytesReceivedRef.current[fileId] = 0;
        if (!speedRef.current[fileId]) speedRef.current[fileId] = { lastBytes: 0, lastTime: performance.now() };
        if (!uiThrottleRef.current[fileId]) uiThrottleRef.current[fileId] = 0;
        if (!bufferRef.current[fileId]) bufferRef.current[fileId] = new Uint8Array(BUFFER_THRESHOLD);
        if (!bufferOffsetRef.current[fileId]) bufferOffsetRef.current[fileId] = 0;
        if (!blobPartsRef.current[fileId]) blobPartsRef.current[fileId] = [];
    };

    const sendAck = (fileId, chunkIndex) => {
        connection.send({ type: "ack", fileId, chunkIndex });
    };

    const updateBytesReceived = (fileId, chunkSize) => {
        bytesReceivedRef.current[fileId] += chunkSize;
    };

    const calculateSpeed = (fileId) => {
        const now = performance.now();
        const deltaTime = (now - speedRef.current[fileId].lastTime) / 1000;
        let speed = 0;
        if (deltaTime > 0) {
            speed = (bytesReceivedRef.current[fileId] - speedRef.current[fileId].lastBytes) / deltaTime;
            speedRef.current[fileId] = { lastBytes: bytesReceivedRef.current[fileId], lastTime: now };
        }
        return speed;
    };

    const throttleUIUpdate = (fileId, speed) => {
        const now = performance.now();
        if (now - uiThrottleRef.current[fileId] >= UI_UPDATE_INTERVAL) {
            updateDownload(fileId, {
                progress: bytesReceivedRef.current[fileId],
                speed,
                state: "receiving",
            });
            uiThrottleRef.current[fileId] = now;
        }
    };

    const flushBuffer = (fileId) => {
        const offset = bufferOffsetRef.current[fileId];
        if (offset === 0) return;

        // Slice the used portion and push as Blob
        const blob = new Blob([bufferRef.current[fileId].slice(0, offset)]);
        blobPartsRef.current[fileId].push(blob);

        // Reset buffer offset
        bufferOffsetRef.current[fileId] = 0;
    };

    const finalizeFile = (fileId) => {
        flushBuffer(fileId);
        const download = downloadMapRef.current[fileId];
        if (!download) return;

        const blob = new Blob(blobPartsRef.current[fileId], { type: download.metadata.type || "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = download.metadata.name;
        a.click();

        URL.revokeObjectURL(url);
        console.log(`🎉 Download completed: "${download.metadata.name}" (ID: ${fileId})`);

        // Cleanup
        delete bytesReceivedRef.current[fileId];
        delete speedRef.current[fileId];
        delete uiThrottleRef.current[fileId];
        delete bufferRef.current[fileId];
        delete bufferOffsetRef.current[fileId];
        delete blobPartsRef.current[fileId];
    };

    const checkCompletion = (fileId) => {
        const download = downloadMapRef.current[fileId];
        if (download && bytesReceivedRef.current[fileId] >= download.metadata.size) {
            const speed = calculateSpeed(fileId);
            updateDownload(fileId, {
                progress: download.metadata.size,
                speed,
                state: "completed",
            });
            finalizeFile(fileId);
        }
    };

    useEffect(() => {
        downloadMapRef.current = Object.fromEntries(downloads.map(d => [d.id, d]));
    }, [downloads]);

    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (data.type !== "chunk") return;

            const { fileId, chunkIndex } = data;
            const chunk = data.data;
            const download = downloadMapRef.current[fileId];
            if (!download) return;

            sendAck(fileId, chunkIndex);
            initRefs(fileId, download.metadata.size);

            if (chunk) {
                // Append chunk to buffer
                const offset = bufferOffsetRef.current[fileId];
                bufferRef.current[fileId].set(new Uint8Array(chunk), offset);
                bufferOffsetRef.current[fileId] += chunk.byteLength;
                updateBytesReceived(fileId, chunk.byteLength);

                // Flush buffer if threshold reached
                if (bufferOffsetRef.current[fileId] >= BUFFER_THRESHOLD) flushBuffer(fileId);
            }

            const speed = calculateSpeed(fileId);
            throttleUIUpdate(fileId, speed);
            checkCompletion(fileId);

            data.data = null; // free memory
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, updateDownload]);
};
