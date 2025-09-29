import { useEffect, useRef } from "react";
import { usePeer } from "../contexts/PeerContext";

const CHUNK_SIZE = 256 * 1024; // 256 KB

/**
 * Hook to handle sequential file sending with ack-based flow.
 * @param {Array} files - Files from FileContext
 * @param {Function} updateFile - FileContext update helper
 */
export const useFileSender = (files, updateFile) => {
    const { connection, isConnectionReady } = usePeer();

    const currentFileIdRef = useRef(null);
    const currentChunkIndexRef = useRef(0);
    const isSendingRef = useRef(false);

    // -------------------- Helper: Send a chunk --------------------
    const sendChunk = async (file, chunkIndex) => {
        const actualFile = file.file;
        const startByte = chunkIndex * CHUNK_SIZE;
        const endByte = Math.min(startByte + CHUNK_SIZE, actualFile.size);
        const chunk = actualFile.slice(startByte, endByte);
        const data = await chunk.arrayBuffer(); // MUST await

        connection.send({
            type: "chunk",
            fileId: file.id,
            chunkIndex,
            data,
        });
    };

    // -------------------- Helper: Start file transfer --------------------
    const startFileTransfer = (file) => {
        currentFileIdRef.current = file.id;
        currentChunkIndexRef.current = 0;
        isSendingRef.current = true;

        updateFile(file.id, { state: "sending", progress: 0 });
        console.log(`📤 Starting file transfer: "${file.metadata.name}" (ID: ${file.id})`);

        sendChunk(file, 0);
    };

    // -------------------- Handle ACK → send next --------------------
    const processAck = (ack) => {
        if (ack.fileId !== currentFileIdRef.current) return;

        const file = files.find(f => f.id === ack.fileId);
        if (!file) return;

        const nextChunk = ack.chunkIndex + 1;
        const bytesSent = Math.min(nextChunk * CHUNK_SIZE, file.metadata.size);
        const isLastChunk = bytesSent >= file.metadata.size;

        if (!isLastChunk) {
            currentChunkIndexRef.current = nextChunk;
            sendChunk(file, nextChunk);
            updateFile(file.id, { progress: bytesSent });
        } else {
            console.log(`🎉 File transfer completed: "${file.metadata.name}"`);
            updateFile(file.id, { state: "sent", progress: file.metadata.size });

            currentFileIdRef.current = null;
            currentChunkIndexRef.current = 0;
            isSendingRef.current = false;
        }
    };

    // -------------------- Effect 1: Pick next pending file --------------------
    useEffect(() => {
        if (!isConnectionReady || isSendingRef.current) return;

        const nextFile = files.find(f => f.status.state === "pending");
        if (nextFile) startFileTransfer(nextFile);
    }, [files, isConnectionReady]);

    // -------------------- Effect 2: Handle incoming ACK --------------------
    useEffect(() => {
        if (!connection) return;

        const handleData = (data) => {
            if (data.type === "ack") processAck(data);
        };

        connection.on("data", handleData);
        return () => connection.off("data", handleData);
    }, [connection, files]);
};
