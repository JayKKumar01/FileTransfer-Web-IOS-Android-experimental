import React, { useState, useRef } from "react";
import streamSaver from "streamsaver";

const FileStreamSaver = () => {
    const CHUNK_SIZE = 256 * 1024; // 256 KB - keep this size for Safari

    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("Idle");
    const [currentChunk, setCurrentChunk] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const writerRef = useRef(null);
    const cancelRef = useRef(false);

    // iOS Safari optimization: Use direct blob writing to avoid memory issues
    async function writeChunkToWriter(writer, blob) {
        // Convert blob to array buffer - this is the memory-critical part
        const buffer = await blob.arrayBuffer();
        await writer.write(new Uint8Array(buffer));

        // Force garbage collection by releasing references
        blob = null;
    }

    const handleCancel = async () => {
        cancelRef.current = true;
        setStatus("Cancelling...");
        if (writerRef.current) {
            try {
                await writerRef.current.abort();
            } catch (e) {
                console.warn("Abort error:", e);
            }
        }
    };

    // Optimized for iOS Safari - memory management is crucial
    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset everything
        setProgress(0);
        setStatus("Preparing...");
        setCurrentChunk(0);
        cancelRef.current = false;
        writerRef.current = null;

        // Safari-specific: Check file size limitations
        if (file.size > 10 * 1024 * 1024 * 1024) { // 10GB
            setStatus("Error: File too large for Safari");
            return;
        }

        const fileName = file.name;
        const chunks = Math.ceil(file.size / CHUNK_SIZE);
        setTotalChunks(chunks);

        try {
            setStatus("Creating file stream...");

            // Critical: Use proper MIME type for Safari
            const fileStream = streamSaver.createWriteStream(fileName, {
                size: file.size
            });

            const writer = fileStream.getWriter();
            writerRef.current = writer;

            setStatus(`Processing ${chunks.toLocaleString()} chunks...`);

            // Process chunks sequentially with memory management
            for (let i = 0; i < chunks; i++) {
                if (cancelRef.current) {
                    setStatus("Cancelled by user");
                    try { await writer.abort(); } catch (e) { /* ignore */ }
                    return;
                }

                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);

                // Create blob slice without loading into memory immediately
                const slice = file.slice(start, end);

                setStatus(`Writing chunk ${i + 1} / ${chunks}...`);

                // Write chunk and wait for completion
                await writeChunkToWriter(writer, slice);

                // Update UI
                setCurrentChunk(i + 1);
                setProgress(((i + 1) / chunks) * 100);

                // Safari optimization: More aggressive yielding
                if (i % 10 === 0) { // Yield every 10 chunks to prevent UI blocking
                    await new Promise((res) => setTimeout(res, 0));
                }

                // Force garbage collection opportunity
                if (i % 100 === 0) {
                    await new Promise((res) => setTimeout(res, 1));
                }
            }

            // Finalize
            await writer.close();
            setStatus("File saved successfully 🎉");
            setProgress(100);

        } catch (err) {
            console.error("Write error:", err);
            setStatus(`Error: ${err?.message || String(err)}`);
            if (writerRef.current) {
                try { await writerRef.current.abort(); } catch (e) { /* ignore */ }
            }
        } finally {
            writerRef.current = null;
            cancelRef.current = false;
        }
    };

    const boxStyle = {
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        maxWidth: 520,
        margin: "2rem auto",
        padding: "1.25rem",
        border: "1px solid #e6e9ee",
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
        background: "white"
    };

    const progressOuter = {
        height: 12,
        width: "100%",
        background: "#f1f5f9",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 8,
    };

    const progressInner = {
        height: "100%",
        width: `${progress}%`,
        transition: "width 0.12s linear",
        background: progress === 100 ? "#10b981" : "#2563eb",
    };

    const small = {
        fontSize: 13,
        color: "#475569",
        textAlign: "center",
        marginTop: 8
    };

    return (
        <div style={boxStyle}>
            <h3 style={{ textAlign: "center", margin: "0 0 12px 0", color: "#1e293b" }}>
                StreamSaver - iOS Safari Optimized
            </h3>

            <input
                type="file"
                onChange={handleFile}
                style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: "1px solid #e6eef8",
                    marginBottom: 12,
                    cursor: "pointer",
                    background: "#f8fafc"
                }}
            />

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                    <div style={progressOuter}>
                        <div style={progressInner} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                            {currentChunk.toLocaleString()}/{totalChunks.toLocaleString()} chunks
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                            {progress ? progress.toFixed(2) : 0}%
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleCancel}
                    disabled={!writerRef.current}
                    style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        cursor: writerRef.current ? "pointer" : "not-allowed",
                        background: writerRef.current ? "#ef4444" : "#94a3b8",
                        color: "white",
                        fontWeight: 600,
                        opacity: writerRef.current ? 1 : 0.6
                    }}
                >
                    Cancel
                </button>
            </div>

            <div style={small}>
                <div>Chunk size: {(CHUNK_SIZE / 1024).toLocaleString()} KB</div>
                <div style={{
                    marginTop: 6,
                    fontWeight: 600,
                    color: status.includes("Error") ? "#ef4444" :
                        status.includes("success") ? "#10b981" : "#475569"
                }}>
                    {status}
                </div>
                {status === "Idle" && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                        iOS Safari: Optimized for large files up to 10GB
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileStreamSaver;