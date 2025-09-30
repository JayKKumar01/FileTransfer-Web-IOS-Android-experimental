import { useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";

/**
 * Hook to handle sending and receiving file metadata.
 * @param {Array} files - Current list of files from FileContext
 * @param {Function} updateFile - Update file helper from FileContext
 * @param {Function} addDownloads - Add multiple downloads at once
 */
export const useFileMetadata = (files, updateFile, addDownloads) => {
    const { connection, isConnectionReady } = usePeer();

    // -------------------- Send Metadata --------------------
    useEffect(() => {
        if (!connection || !isConnectionReady) return;

        const unsentFiles = files.filter(f => !f.metaSent);
        if (!unsentFiles.length) return;

        try {
            const payload = unsentFiles.map(file => ({
                id: file.id,
                metadata: file.metadata,
            }));

            connection.send({ type: "metadata", payload });

            unsentFiles.forEach(file => updateFile(file.id, { metaSent: true }));

            console.log(
                `✅ Metadata sent for ${unsentFiles.length} file(s):`,
                payload.map(f => `"${f.metadata.name}" (ID: ${f.id}, Size: ${f.metadata.size}, Type: ${f.metadata.type})`)
            );
        } catch (err) {
            console.error("❌ Failed to send metadata:", err);
        }
    }, [files, connection, isConnectionReady, updateFile]);

    // -------------------- Receive Metadata --------------------
    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (!data || data.type !== "metadata" || !Array.isArray(data.payload)) return;

            const downloadsToAdd = data.payload.map(f => ({
                id: f.id,
                metadata: f.metadata,
                status: { state: "pending", progress: 0, speed: 0 },
            }));

            addDownloads(downloadsToAdd);

            console.log(
                `📥 Received metadata for ${downloadsToAdd.length} file(s):`,
                downloadsToAdd.map(d => `"${d.metadata.name}" (ID: ${d.id}, Size: ${d.metadata.size}, Type: ${d.metadata.type})`)
            );
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, addDownloads]);
};
