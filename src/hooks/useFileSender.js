import { useEffect, useState, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

const CHUNK_SIZE = 256 * 1024; // 256 KB

/**
 * Hook to handle sequential file sending with ack-based flow.
 * @param {Array} files - Files from FileContext
 * @param {Function} updateFile - FileContext update helper
 */
export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const [currentFileId, setCurrentFileId] = useState(null);
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const isSendingRef = useRef(false);

    // -------------------- Helper: Start file transfer --------------------
    const startFileTransfer = (file) => {
        setCurrentFileId(file.id);
        setCurrentChunkIndex(0);
        isSendingRef.current = true;

        updateFile(file.id, { state: "sending", progress: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}" (ID: ${file.id})`);

        sendChunk(file, 0);
    };

    // -------------------- Helper: Send a chunk --------------------
    const sendChunk = (file, chunkIndex) => {
        console.log(`➡️ Sending chunk #${chunkIndex} for "${file.metadata.name}"`);

        // Placeholder for now (later: slice → ArrayBuffer → send)
        connection.send({
            type: "chunk",
            fileId: file.id,
            chunkIndex,
            data: "PLACEHOLDER",
        });
    };

    // -------------------- Handle ACK → send next --------------------
    const processAck = (ack) => {
        if (ack.fileId !== currentFileId) return;

        console.log(`✅ Ack for file ${ack.fileId}, chunk #${ack.chunkIndex}`);

        const file = files.find((f) => f.id === ack.fileId);
        if (!file) return;

        const nextChunk = ack.chunkIndex + 1;
        const bytesSent = Math.min(nextChunk * CHUNK_SIZE, file.metadata.size);
        const isLastChunk = bytesSent >= file.metadata.size;

        if (!isLastChunk) {
            setCurrentChunkIndex(nextChunk);
            sendChunk(file, nextChunk);

            updateFile(file.id, {
                progress: bytesSent,
            });
        } else {
            console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
            updateFile(file.id, {
                state: "completed",
                progress: file.metadata.size,
            });

            setCurrentFileId(null);
            setCurrentChunkIndex(0);
            isSendingRef.current = false;
        }
    };

    // -------------------- Effect 1: Pick next pending file --------------------
    useEffect(() => {
        if (!isConnectionReady || isSendingRef.current) return;

        const nextFile = files.find((f) => f.status.state === "pending");
        if (nextFile) {
            startFileTransfer(nextFile);
        }
    }, [files, isConnectionReady]);

    // -------------------- Effect 2: Handle incoming ACK --------------------
    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (data.type === "ack") {
                processAck(data);
            }
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, files, currentFileId, currentChunkIndex]);
};
