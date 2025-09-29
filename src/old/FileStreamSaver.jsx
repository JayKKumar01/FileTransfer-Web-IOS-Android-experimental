import React, { useState, useRef } from "react";
import streamSaver from "streamsaver";

const FileStreamSaver = () => {
    const [chunkSize, setChunkSize] = useState(256 * 1024); // default 256 KB
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("Idle");
    const [currentChunk, setCurrentChunk] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const writerRef = useRef(null);
    const cancelRef = useRef(false);

    // Use refs for values that don't need re-renders
    const progressRef = useRef(0);
    const currentChunkRef = useRef(0);

    // Batch UI updates - only update at most once per frame
    const updateUI = React.useCallback(() => {
        requestAnimationFrame(() => {
            setProgress(progressRef.current);
            setCurrentChunk(currentChunkRef.current);
        });
    }, []);

    async function writeChunkToWriter(writer, buffer) {
        await writer.write(new Uint8Array(buffer));
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

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset everything
        setProgress(0);
        setStatus("Preparing...");
        setCurrentChunk(0);
        setTotalChunks(0);
        progressRef.current = 0;
        currentChunkRef.current = 0;
        cancelRef.current = false;
        writerRef.current = null;

        const fileName = file.name;
        const chunks = Math.ceil(file.size / chunkSize);
        setTotalChunks(chunks);

        try {
            setStatus("Creating file stream...");

            const fileStream = streamSaver.createWriteStream(fileName, {
                size: file.size
            });

            const writer = fileStream.getWriter();
            writerRef.current = writer;

            setStatus(`Processing ${chunks.toLocaleString()} chunks...`);

            for (let i = 0; i < chunks; i++) {
                if (cancelRef.current) {
                    setStatus("Cancelled by user");
                    try { await writer.abort(); } catch (e) { /* ignore */ }
                    return;
                }

                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const slice = file.slice(start, end);
                const buffer = await slice.arrayBuffer();

                if (i % 10 === 0 || i === chunks - 1) {
                    setStatus(`Writing chunk ${i + 1} / ${chunks}...`);
                }

                await writeChunkToWriter(writer, buffer);

                currentChunkRef.current = i + 1;
                progressRef.current = ((i + 1) / chunks) * 100;

                if (i % 5 === 0 || i === chunks - 1) {
                    updateUI();
                }

                if (i % 10 === 0) {
                    await new Promise((res) => setTimeout(res, 0));
                }
            }

            progressRef.current = 100;
            currentChunkRef.current = chunks;
            updateUI();

            await writer.close();
            setStatus("File saved successfully 🎉");

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

            {/* Dropdown for chunk size */}
            <select
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                style={{
                    display: "block",
                    width: "100%",
                    padding: "8px",
                    borderRadius: 8,
                    border: "1px solid #e6eef8",
                    marginBottom: 12,
                    background: "#f8fafc",
                    cursor: "pointer"
                }}
            >
                <option value={256 * 1024}>256 KB</option>
                <option value={512 * 1024}>512 KB</option>
                <option value={1024 * 1024}>1 MB</option>
                <option value={2 * 1024 * 1024}>2 MB</option>
                <option value={4 * 1024 * 1024}>4 MB</option>
            </select>

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
                            {progress.toFixed(1)}%
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
                <div>Chunk size: {(chunkSize / 1024).toLocaleString()} KB</div>
                <div style={{
                    marginTop: 6,
                    fontWeight: 600,
                    color: status.includes("Error") ? "#ef4444" :
                        status.includes("success") ? "#10b981" : "#475569"
                }}>
                    {status}
                </div>
            </div>
        </div>
    );
};

export default FileStreamSaver;
