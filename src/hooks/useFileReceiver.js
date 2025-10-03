import { useEffect, useMemo } from "react";
import { usePeer } from "../contexts/PeerContext";

const UPS = 3;
const UI_UPDATE_INTERVAL = 1000 / UPS;

export const useFileReceiver = (downloads, updateDownload) => {
    const { connection } = usePeer();

    // Map for faster lookup
    const downloadMap = useMemo(() => {
        const map = {};
        downloads.forEach(d => { map[d.id] = d; });
        return map;
    }, [downloads]);

    useEffect(() => {
        if (!connection || !downloads.length) return;

        const handleData = async (data) => {
            if (!data || data.type !== "chunk") return;

            const { fileId, chunkIndex, data: chunk, crc } = data;
            const download = downloadMap[fileId];
            if (!download) return;

            // -------------------- Send ACK --------------------
            connection.send({ type: "ack", fileId, chunkIndex });

            // -------------------- Update tracking --------------------
            download.trackingManager.addBytes(chunk.byteLength);

            // -------------------- Write chunk to storage --------------------
            // Start push but do not await immediately to avoid blocking UI updates
            const pushPromise = download.storageManager.pushChunk(chunk);

            // -------------------- Throttle UI updates --------------------
            if (download.trackingManager.shouldUpdateUI(UI_UPDATE_INTERVAL)) {
                updateDownload(fileId, {
                    progress: download.trackingManager.getProgress(),
                    speed: download.trackingManager.getSpeed(),
                    state: "receiving",
                });
            }

            // -------------------- Check completion --------------------
            if (download.trackingManager.isComplete()) {
                await pushPromise; // wait for last chunk to finish
                const blobs = await download.storageManager.finalize();

                // Use CRC from the last chunk, if available
                const finalCrc = crc !== undefined ? crc >>> 0 : undefined;

                // Log the CRC for debugging
                console.log(`✅ Final CRC received for file ${fileId}:`, finalCrc);

                updateDownload(fileId, {
                    progress: download.trackingManager.getTotalSize(),
                    speed: 0,
                    state: blobs ? "received" : "downloaded",
                    blobs,
                    crc: finalCrc, // assign CRC only at the end
                });

            } else {
                // Wait for chunk write to complete without blocking
                pushPromise.catch(console.error);
            }

            // Free memory
            data.data = null;
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, downloadMap, updateDownload]);
};
