import { useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";

/**
 * Hook to handle receiving file chunks, updating progress, speed, and completion.
 * @param {Array} downloads - Array of download items
 * @param {Function} updateDownload - Callback to update download state
 */
export const useFileReceiver = (downloads, updateDownload) => {
    const { connection } = usePeer();
    const UI_UPDATE_INTERVAL = 1000 / 6; // ~6 FPS

    useEffect(() => {
        if (!connection || !downloads.length) return;

        const handleData = async (data) => {
            if (!data || data.type !== "chunk") return;

            const { fileId, chunkIndex, data: chunk } = data;
            const download = downloads.find(d => d.id === fileId);
            if (!download) return;

            // -------------------- Send ACK --------------------
            connection.send({ type: "ack", fileId, chunkIndex });

            // -------------------- Write chunk to storage --------------------
            await download.storageManager.pushChunk(chunk);

            // -------------------- Update tracking --------------------
            download.trackingManager.addBytes(chunk.byteLength);

            // -------------------- Throttle UI updates --------------------
            if (download.trackingManager.shouldUpdateUI(UI_UPDATE_INTERVAL)) {
                updateDownload(fileId, {
                    progress: download.trackingManager.getProgress(), // bytes received
                    speed: download.trackingManager.getSpeed(),
                    state: "receiving",
                });
            }

            // -------------------- Check completion --------------------
            if (download.trackingManager.isComplete()) {
                const finalBlob = await download.storageManager.finalize();

                updateDownload(fileId, {
                    progress: download.trackingManager.getTotalSize(),
                    speed: 0,
                    state: "received",
                    blob: finalBlob,
                });
            }

            // Free memory
            data.data = null;
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, downloads, updateDownload]);
};
