import { useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";

/**
 * Hook to handle sending and receiving file metadata.
 * @param {Array} files - Current list of files from FileContext
 * @param {Function} updateFile - Update file helper from FileContext
 */
export const useFileMetadata = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    // -------------------- Send Metadata Effect --------------------
    useEffect(() => {
        if (!connection || !isConnectionReady) return;

        const unsentFiles = files.filter((f) => !f.metaSent);
        if (unsentFiles.length === 0) return;

        try {
            // Prepare payload
            const payload = unsentFiles.map((file) => ({
                id: file.id,
                metadata: file.metadata,
            }));

            // Send all metadata at once
            connection.send({
                type: "metadata",
                payload,
            });

            // Update all as sent
            unsentFiles.forEach((file) => updateFile(file.id, { metaSent: true }));

            // ✅ Success log
            console.log(
                `Metadata sent successfully for ${unsentFiles.length} file(s):`,
                payload.map(f => `"${f.metadata.name}" (ID: ${f.id}, Size: ${f.metadata.size}, Type: ${f.metadata.type})`)
            );
        } catch (err) {
            console.error("Failed to send metadata:", err);
        }
    }, [files, connection, isConnectionReady, updateFile]);

    // -------------------- Receive Metadata Effect --------------------
    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (!data || data.type !== "metadata" || !Array.isArray(data.payload)) return;

            data.payload.forEach((fileMeta) => {
                console.log(
                    `Metadata received: "${fileMeta.metadata.name}" | ID: ${fileMeta.id} | Size: ${fileMeta.metadata.size} | Type: ${fileMeta.metadata.type}`
                );
            });
        };

        connection.on("data", handleData);

        return () => {
            if (connection) connection.off("data", handleData);
        };
    }, [connection]);
};
