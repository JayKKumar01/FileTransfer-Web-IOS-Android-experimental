import React, { useState } from "react";

const FileSenderTest = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("idle"); // idle | sending | done
    const [progress, setProgress] = useState(0);
    const [sentSize, setSentSize] = useState(0);
    const [chunk, setChunk] = useState(null); // simulate memory usage
    const [chunkSize] = useState(256 * 1024); // 256 KB default

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) {
            setFile(f);
            setStatus("idle");
            setProgress(0);
            setSentSize(0);
            setChunk(null);
        }
    };

    const handleSend = async () => {
        if (!file) return;
        setStatus("sending");

        const totalChunks = Math.ceil(file.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(file.size, start + chunkSize);

            // read only this slice
            const slice = file.slice(start, end);
            const arrayBuffer = await slice.arrayBuffer();

            // keep only this chunk in memory
            setChunk(new Uint8Array(arrayBuffer));

            // update progress
            const sent = end;
            setSentSize(sent);
            setProgress(((i + 1) / totalChunks) * 100);

            // simulate small delay (like sending over network)
            await new Promise((r) => setTimeout(r, 10));
        }

        // finished
        setChunk(null); // free memory
        setStatus("done");
    };

    return (
        <div style={{ maxWidth: 600, margin: "20px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
            <h2 style={{ marginBottom: 10 }}>File Sender Simulation</h2>

            <input type="file" onChange={handleFileChange} disabled={status === "sending"} />

            {file && (
                <div style={{ marginTop: 15 }}>
                    <div><strong>File:</strong> {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</div>
                    <div><strong>Chunk size:</strong> {(chunkSize / 1024).toFixed(0)} KB</div>
                </div>
            )}

            {status === "sending" && (
                <div style={{ marginTop: 15, fontSize: 14 }}>
                    Sending... {progress.toFixed(1)}% ({(sentSize / (1024 * 1024)).toFixed(2)} MB / {(file.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
            )}

            {status === "done" && (
                <div style={{ marginTop: 15, color: "green", fontWeight: "bold" }}>
                    ✅ File sent successfully!
                </div>
            )}

            {file && status === "idle" && (
                <button
                    onClick={handleSend}
                    style={{ marginTop: 15, padding: "10px 20px", background: "#2196f3", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                    Send
                </button>
            )}

            <div style={{ marginTop: 15, height: 20, width: "100%", background: "#eee", borderRadius: 10, overflow: "hidden" }}>
                <div
                    style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: progress === 100 ? "#4caf50" : "#2196f3",
                        transition: "width 0.2s ease"
                    }}
                />
            </div>

            {chunk && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
                    Current chunk size in memory: {chunk.length} bytes
                </div>
            )}
        </div>
    );
};

export default FileSenderTest;
