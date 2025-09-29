import { useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";

/**
 * Hook to handle receiving file chunks (ack-only for now).
 */
export const useFileReceiver = () => {
    const { connection } = usePeer();

    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (data.type !== "chunk") return;

            const { fileId, chunkIndex } = data;

            // ✅ Ack back immediately
            connection.send({
                type: "ack",
                fileId,
                chunkIndex,
            });

            console.log(`⬅️ Received chunk #${chunkIndex} for file ID: ${fileId} → Ack sent`);
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection]);
};
