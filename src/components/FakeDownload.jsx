import React, { useState, useRef } from "react";

const BufferedFileDownloader = () => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("Idle");
    const [bufferSize, setBufferSize] = useState(256 * 1024); // default 256 KB
    const cancelRef = useRef(false);

    const flushBuffer = (buffer, blobParts) => {
        if (buffer.length > 0) {
            blobParts.push(new Blob(buffer));
            buffer.length = 0;
        }
    };

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const chunkSize = 256 * 1024; // fixed slice size
        const bufferMaxBytes = bufferSize;
        const buffer = [];
        let bufferBytes = 0;
        const blobParts = [];

        setProgress(0);
        setStatus("Starting processing...");
        cancelRef.current = false;

        let offset = 0;

        while (offset < file.size) {
            if (cancelRef.current) {
                setStatus("Cancelled by user");
                return;
            }

            const slice = file.slice(offset, offset + chunkSize);
            const chunk = await slice.arrayBuffer();
            buffer.push(chunk);
            bufferBytes += chunk.byteLength;

            if (bufferBytes >= bufferMaxBytes) {
                flushBuffer(buffer, blobParts);
                bufferBytes = 0;
            }

            offset += chunkSize;

            setProgress(Math.min((offset / file.size) * 100, 100));
            setStatus(
                `Processing chunk ${(offset / chunkSize).toFixed(0)}, buffer ${(bufferBytes / 1024).toFixed(0)} KB`
            );

            if ((offset / chunkSize) % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        }

        flushBuffer(buffer, blobParts);

        const finalBlob = new Blob(blobParts, { type: file.type || "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(finalBlob);
        link.download = file.name;
        link.click();

        setStatus("Download complete!");
        setProgress(100);
    };

    const cancelProcessing = () => {
        cancelRef.current = true;
        setStatus("Cancelling...");
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                width: "100%",
                color: "#fff", // default text color for dark-grey background
            }}
        >
            <label style={{ fontWeight: "bold", color: "#fff" }}>
                Select Buffer Size:{" "}
                <select
                    value={bufferSize}
                    onChange={(e) => setBufferSize(parseInt(e.target.value))}
                    style={{
                        padding: "6px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        backgroundColor: "#333",
                        color: "#fff",
                    }}
                >
                    <option value={256 * 1024}>256 KB</option>
                    <option value={512 * 1024}>512 KB</option>
                    <option value={1024 * 1024}>1 MB</option>
                    <option value={2 * 1024 * 1024}>2 MB</option>
                    <option value={4 * 1024 * 1024}>4 MB</option>
                    <option value={8 * 1024 * 1024}>8 MB</option>
                </select>
            </label>

            <input
                type="file"
                onChange={handleFile}
                style={{
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    backgroundColor: "#333",
                    color: "#fff",
                }}
            />

            <div
                style={{
                    width: "100%",
                    maxWidth: "400px",
                    height: "20px",
                    background: "#555",
                    borderRadius: "4px",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "#4a90e2",
                        transition: "width 0.2s",
                    }}
                ></div>
            </div>

            <p style={{ fontSize: "14px", color: "#fff", margin: 0 }}>{status}</p>

            <button
                onClick={cancelProcessing}
                style={{
                    padding: "6px 12px",
                    background: "#e74c3c",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
            >
                Cancel
            </button>
        </div>
    );
};

export default BufferedFileDownloader;
