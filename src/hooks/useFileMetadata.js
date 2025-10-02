import { useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";
import { useContext } from "react";
import { TabContext } from "../contexts/TabContext";
import {createTrackingManager} from "../utils/createTrackingManager";
import {createStorageManager} from "../utils/createStorageManager";
/**
 * Hook to handle sending and receiving file metadata.
 */
export const useFileMetadata = (files, updateFile, addDownloads) => {
    const { connection, isConnectionReady } = usePeer();
    const { setActiveTab } = useContext(TabContext);

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
                status: {
                    state: "waiting",
                    progress: 0,
                    speed: 0,
                    blobs: null,
                },
                trackingManager: createTrackingManager({ totalSize: f.metadata.size }),
                storageManager: createStorageManager(f.metadata, (msg) => {
                    console.log(msg);       // optional console log
                }),

            }));



            addDownloads(downloadsToAdd);

            console.log(
                `📥 Received metadata for ${downloadsToAdd.length} file(s):`,
                downloadsToAdd.map(d => `"${d.metadata.name}" (ID: ${d.id}, Size: ${d.metadata.size}, Type: ${d.metadata.type})`)
            );

            // -------------------- Switch Tab --------------------
            if (downloadsToAdd.length > 0) {
                setActiveTab("RECEIVE"); // TabBar will handle navigation
            }
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, addDownloads, setActiveTab]);
};
