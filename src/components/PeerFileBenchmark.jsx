import React, { useState, useEffect, useRef, useContext } from "react";
import { usePeer } from "../contexts/PeerContext";
import { LogContext } from "../contexts/LogContext";

const CHUNK_SIZE = 256 * 1024; // 256 KB

const PeerFileBenchmark = () => {
    const { connection, isConnectionReady } = usePeer();
    const { pushLog } = useContext(LogContext);

    const [blobTimes, setBlobTimes] = useState([]);
    const [abTimes, setAbTimes] = useState([]);
    const [progress, setProgress] = useState(0);
    const [chunkIndex, setChunkIndex] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);

    const blobTotalTimeRef = useRef(0);
    const abTotalTimeRef = useRef(0);

    const average = (arr) =>
        arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : "-";

    // Handle incoming data
    useEffect(() => {
        if (!connection) return;

        const handler = (msg) => {
            if (msg.type === "blob-test") {
                connection.send({ type: "ack", id: msg.id, mode: "blob" });
                // Ensure we have a proper Blob instance
                const receivedBlob = msg.blob instanceof Blob ? msg.blob : new Blob([msg.blob]);
                pushLog(`📦 Received Blob #${msg.id} (${receivedBlob.size} bytes)`);
            } else if (msg.type === "ab-test") {
                connection.send({ type: "ack", id: msg.id, mode: "ab" });
                const receivedAB = msg.ab instanceof ArrayBuffer ? msg.ab : msg.ab.buffer || msg.ab;
                pushLog(`📦 Received ArrayBuffer #${msg.id} (${receivedAB.byteLength} bytes)`);
            }
        };


        connection.on("data", handler);
        return () => connection.off("data", handler);
    }, [connection, pushLog]);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!isConnectionReady) {
            pushLog("⚠️ Connection not ready.");
            return;
        }

        pushLog(`📁 Selected file: ${file.name} (${file.size} bytes)`);

        let offset = 0;
        let index = 0;
        const total = Math.ceil(file.size / CHUNK_SIZE);
        setTotalChunks(total);

        while (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            offset += CHUNK_SIZE;

            // Blob test
            const startBlob = performance.now();
            connection.send({ type: "blob-test", id: index, blob: slice });
            await new Promise((resolve) => {
                const ackHandler = (msg) => {
                    if (msg.type === "ack" && msg.id === index && msg.mode === "blob") {
                        const elapsed = performance.now() - startBlob;
                        setBlobTimes((t) => [...t, elapsed]);
                        blobTotalTimeRef.current += elapsed;
                        connection.off("data", ackHandler);
                        resolve();
                    }
                };
                connection.on("data", ackHandler);
            });

            // ArrayBuffer test
            const buffer = await slice.arrayBuffer();
            const startAb = performance.now();
            connection.send({ type: "ab-test", id: index, ab: buffer });
            await new Promise((resolve) => {
                const ackHandler = (msg) => {
                    if (msg.type === "ack" && msg.id === index && msg.mode === "ab") {
                        const elapsed = performance.now() - startAb;
                        setAbTimes((t) => [...t, elapsed]);
                        abTotalTimeRef.current += elapsed;
                        connection.off("data", ackHandler);
                        resolve();
                    }
                };
                connection.on("data", ackHandler);
            });

            index++;
            setChunkIndex(index);
            setProgress(Math.floor((index / total) * 100));

            // Yield control to UI to prevent blocking
            if (index % 4 === 0) await new Promise((r) => setTimeout(r, 0));
        }

        pushLog(
            `✅ Benchmark completed | Avg Blob: ${average(blobTimes)} ms | Total Blob: ${blobTotalTimeRef.current.toFixed(
                2
            )} ms | Avg ArrayBuffer: ${average(abTimes)} ms | Total ArrayBuffer: ${abTotalTimeRef.current.toFixed(
                2
            )} ms`
        );
    };

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "6px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                minWidth: 0,
            }}
        >
            <input
                type="file"
                onChange={handleFileSelect}
                style={{ marginBottom: "6px", padding: "4px", fontSize: "14px", borderRadius: "4px" }}
            />

            {/* Progress Bar */}
            {progress > 0 && (
                <div style={{ marginBottom: "6px", fontSize: "12px" }}>
                    <div
                        style={{
                            width: "100%",
                            height: "8px",
                            background: "#eee",
                            borderRadius: "4px",
                            overflow: "hidden",
                            marginBottom: "2px",
                        }}
                    >
                        <div style={{ width: `${progress}%`, height: "100%", background: "#4caf50" }} />
                    </div>
                    <div>
                        Chunk: {chunkIndex}/{totalChunks} | Progress: {progress}%<br />
                        Avg Blob: {average(blobTimes)} ms | Total Blob: {blobTotalTimeRef.current.toFixed(2)} ms<br />
                        Avg ArrayBuffer: {average(abTimes)} ms | Total ArrayBuffer: {abTotalTimeRef.current.toFixed(2)} ms
                    </div>
                </div>
            )}
        </div>
    );
};

export default PeerFileBenchmark;
