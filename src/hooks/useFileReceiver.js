import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

/**
 * Hook to handle receiving file chunks, updating progress, speed, and completion.
 * Only keeps UI/tracking logic. Download/buffer logic will be moved out.
 */
export const useFileReceiver = (downloads, updateDownload) => {
    const { connection } = usePeer();

    // Tracking/UI refs
    const bytesReceivedRef = useRef({});
    const speedRef = useRef({});
    const uiThrottleRef = useRef({});
    const downloadMapRef = useRef({});

    const UPS = 6;
    const UI_UPDATE_INTERVAL = 1000 / UPS;

    const initRefs = (fileId) => {
        if (!bytesReceivedRef.current[fileId]) bytesReceivedRef.current[fileId] = 0;
        if (!speedRef.current[fileId]) {
            speedRef.current[fileId] = {
                lastBytes: 0,
                lastTime: performance.now(),
            };
        }
        if (!uiThrottleRef.current[fileId]) uiThrottleRef.current[fileId] = 0;
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
            speed =
                (bytesReceivedRef.current[fileId] -
                    speedRef.current[fileId].lastBytes) / deltaTime;
            speedRef.current[fileId] = {
                lastBytes: bytesReceivedRef.current[fileId],
                lastTime: now,
            };
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

    const checkCompletion = (fileId) => {
        const download = downloadMapRef.current[fileId];
        if (download && bytesReceivedRef.current[fileId] >= download.metadata.size) {
            const speed = calculateSpeed(fileId);
            updateDownload(fileId, {
                progress: download.metadata.size,
                speed,
                state: "completed",
            });
            // Finalization will be handled in util
        }
    };

    // Sync downloads into map
    useEffect(() => {
        downloadMapRef.current = Object.fromEntries(downloads.map((d) => [d.id, d]));
    }, [downloads]);

    // Handle incoming data
    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (data.type !== "chunk") return;

            const { fileId, chunkIndex } = data;
            const chunk = data.data;
            const download = downloadMapRef.current[fileId];
            if (!download) return;

            sendAck(fileId, chunkIndex);
            initRefs(fileId);

            if (chunk) {
                updateBytesReceived(fileId, chunk.byteLength);
                // Buffering/flushing handled in util
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
