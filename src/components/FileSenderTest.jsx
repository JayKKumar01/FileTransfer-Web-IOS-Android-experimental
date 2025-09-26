import React, { useState } from "react";
import localforage from "localforage";

// Configure localForage (cross-platform: Web, iOS, Android)
localforage.config({
    name: "FileTransferDB",
    storeName: "files",
});

const FileSender = () => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);

    // Save/append chunk directly into DB as Blob per fileId
    const sendChunk = async (fileId, chunk, originalName) => {
        const existing = await localforage.getItem(fileId);

        if (existing) {
            const newBlob = new Blob([existing.blob, chunk], {
                type: existing.blob.type || "application/octet-stream",
            });
            await localforage.setItem(fileId, { blob: newBlob, name: originalName });
            console.log(`Appended chunk → fileId: ${fileId}, total size: ${newBlob.size}`);
        } else {
            const newBlob = new Blob([chunk], { type: "application/octet-stream" });
            await localforage.setItem(fileId, { blob: newBlob, name: originalName });
            console.log(`Created new entry → fileId: ${fileId}, size: ${newBlob.size}`);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const chunkSize = 256 * 1024; // 256KB
        let offset = 0;
        const newFileId = Date.now().toString();

        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);

        while (offset < file.size) {
            const slice = file.slice(offset, offset + chunkSize);
            const chunkData = new Uint8Array(await slice.arrayBuffer());

            await sendChunk(newFileId, chunkData, file.name);

            offset += chunkSize;
            setProgress(Math.min(100, Math.round((offset / file.size) * 100)));
        }

        setStatus("completed");

        // Verify saved blob + name
        const finalData = await localforage.getItem(newFileId);
        console.log("✅ File saved in DB:", {
            fileId: newFileId,
            name: finalData.name,
            type: finalData.blob.type,
            size: finalData.blob.size,
        });
    };

    const handleDownload = async () => {
        if (!fileId) {
            alert("No file available for download");
            return;
        }

        const data = await localforage.getItem(fileId);
        if (!data) {
            alert("No file found in DB with id " + fileId);
            return;
        }

        const blob = data.blob;
        const name = data.name || "downloaded_file";

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        console.log(`⬇️ Downloaded fileId: ${fileId}, name: ${name}, size: ${blob.size}`);

        // Clear the entry from DB
        await localforage.removeItem(fileId);
        console.log(`🗑️ Cleared DB entry for fileId: ${fileId}`);

        // Reset state
        setFileId(null);
        setFileName(null);
        setProgress(0);
        setStatus("idle");
    };

    return (
        <div style={{ padding: "16px", fontFamily: "Arial" }}>
            <input
                type="file"
                onChange={handleFileSelect}
                style={{
                    marginBottom: "12px",
                    padding: "6px",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                }}
            />
            <div style={{ marginTop: "10px" }}>
                <div
                    style={{
                        height: "20px",
                        width: "100%",
                        background: "#eee",
                        borderRadius: "10px",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${progress}%`,
                            background: "#4caf50",
                            transition: "width 0.2s",
                        }}
                    ></div>
                </div>
                <p style={{ marginTop: "6px", fontSize: "14px" }}>
                    {status === "idle" && "Select a file to send"}
                    {status === "sending" && `Sending... ${progress}%`}
                    {status === "completed" && "Completed ✅"}
                </p>
            </div>
            <button
                onClick={handleDownload}
                disabled={!fileId}
                style={{
                    marginTop: "12px",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "6px",
                    background: fileId ? "#2196f3" : "#aaa",
                    color: "white",
                    cursor: fileId ? "pointer" : "not-allowed",
                }}
            >
                {fileId ? `Download (${fileName})` : "No File Yet"}
            </button>
        </div>
    );
};

export default FileSender;
