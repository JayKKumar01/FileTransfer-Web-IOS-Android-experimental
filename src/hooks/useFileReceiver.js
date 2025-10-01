import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";
import {useFileTransfer} from "../utils/fileReceiverUtil";

/**
 * Hook to handle receiving file chunks, updating progress, speed, and completion.
 * UI/tracking logic stays in hook, buffering and download handled in util.
 */
export const useFileReceiver = (downloads, updateDownload) => {
    const { connection } = usePeer();
    const { initFile, pushChunk, finalizeFile } = useFileTransfer();


    // Tracking/UI refs
    const bytesReceivedRef = useRef({});
    const speedRef = useRef({});
    const uiThrottleRef = useRef({});
    const downloadMapRef = useRef({});

    const UPS = 6;
    const UI_UPDATE_INTERVAL = 1000 / UPS;

    // Initialize tracking refs and util
    const initRefs = (fileId, fileName, mimeType) => {
        if (!bytesReceivedRef.current[fileId]) bytesReceivedRef.current[fileId] = 0;
        if (!speedRef.current[fileId]) {
            speedRef.current[fileId] = { lastBytes: 0, lastTime: performance.now() };
        }
        if (!uiThrottleRef.current[fileId]) uiThrottleRef.current[fileId] = 0;

        // Initialize file in util (buffer or StreamSaver)
        initFile(fileId, fileName, mimeType);
    };

    const sendAck = (fileId, chunkIndex) => {
        connection?.send({ type: "ack", fileId, chunkIndex });
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

    const checkCompletion = async (fileId) => {
        const download = downloadMapRef.current[fileId];
        if (download && bytesReceivedRef.current[fileId] >= download.metadata.size) {
            updateDownload(fileId, {
                progress: download.metadata.size,
                speed: 0,
                state: "received",
            });

            // Finalize download using util
            await finalizeFile(fileId, download.metadata.name, download.metadata.type);
        }
    };

    // Sync downloads into map
    useEffect(() => {
        downloadMapRef.current = Object.fromEntries(downloads.map(d => [d.id, d]));
    }, [downloads]);

    // Handle incoming data
    useEffect(() => {
        if (!connection) return;

        const handleData = async (data) => {
            if (data.type !== "chunk") return;

            const { fileId, chunkIndex } = data;
            const chunk = data.data;
            const download = downloadMapRef.current[fileId];
            if (!download) return;

            sendAck(fileId, chunkIndex);
            initRefs(fileId, download.metadata.name, download.metadata.type);

            if (chunk) {
                updateBytesReceived(fileId, chunk.byteLength);
                await pushChunk(fileId, chunk); // Send chunk to util
            }

            const speed = calculateSpeed(fileId);
            throttleUIUpdate(fileId, speed);
            await checkCompletion(fileId); // Check completion + finalize

            data.data = null; // free memory
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, updateDownload]);
};
