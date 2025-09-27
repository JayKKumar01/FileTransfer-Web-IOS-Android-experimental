import React, { useState, useContext } from "react";
import { LogContext } from "../contexts/LogContext";
import { createStore, saveChunk, getBlob, clearChunks, getName } from "../utils/chunkUtil";

const useLogger = () => {
    const { pushLog } = useContext(LogContext);
    return (msg) => {
        console.log(msg);
        pushLog(msg);
    };
};

const sendChunkSize = 1024 * 1024 * 2;

const FileSender = () => {
    const [sendProgress, setSendProgress] = useState(0);
    const [assembleProgress, setAssembleProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [fileSize, setFileSize] = useState(0);

    const log = useLogger();

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const newFileId = Date.now().toString();
        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);
        setFileSize(file.size);

        try {
            await createStore(newFileId, file.name);

            let offset = 0;
            while (offset < file.size) {
                const slice = file.slice(offset, offset + sendChunkSize);
                await saveChunk(newFileId, slice); // Directly save Blob slice

                offset += sendChunkSize;
                setSendProgress(Math.min(100, Math.round((offset / file.size) * 100)));
            }

            setStatus("completed");
            log(`✅ File sent → fileId: ${newFileId}, size: ${file.size} bytes`);
        } catch (err) {
            log(`❌ Error sending file: ${err.message}`);
            setStatus("error");
        }
    };

    const handleDownload = async () => {
        if (!fileId) return alert("No file available");

        setAssembleProgress(0);
        setStatus("assembling");

        try {
            const name = await getName(fileId);
            const assembledBlob = await getBlob(fileId, "application/octet-stream", (processed, total) => {
                setAssembleProgress(Math.min(100, Math.round((processed / total) * 100)));
            });

            const url = URL.createObjectURL(assembledBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            log(`⬇️ Downloaded: ${name}, size: ${assembledBlob.size}`);

            await clearChunks(fileId);

            setFileId(null);
            setFileName(null);
            setFileSize(0);
            setSendProgress(0);
            setAssembleProgress(0);
            setStatus("idle");
        } catch (err) {
            log(`❌ Error downloading file: ${err.message}`);
            setStatus("error");
        }
    };

    return (
        <div style={{ padding: "16px", fontFamily: "Arial" }}>
            <input
                type="file"
                onChange={handleFileSelect}
                style={{ marginBottom: "12px", padding: "6px", border: "1px solid #ccc", borderRadius: "6px" }}
            />
            {fileSize > 0 && (
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                    File: {fileName} ({Math.round(fileSize / (1024 * 1024))} MB)
                </p>
            )}

            <div style={{ marginTop: "10px" }}>
                <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${sendProgress}%`, background: "#4caf50", transition: "width 0.2s" }} />
                </div>
                <p style={{ marginTop: "6px", fontSize: "14px" }}>
                    {status === "sending" && `Sending... ${sendProgress}%`}
                    {status === "completed" && `Ready to download`}
                </p>
            </div>

            {status === "assembling" && (
                <div style={{ marginTop: "10px" }}>
                    <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${assembleProgress}%`, background: "#ff9800", transition: "width 0.2s" }} />
                    </div>
                    <p style={{ marginTop: "6px", fontSize: "14px" }}>Assembling... {assembleProgress}%</p>
                </div>
            )}

            <button
                onClick={handleDownload}
                disabled={!fileId || status === "sending"}
                style={{
                    marginTop: "12px",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "6px",
                    background: fileId && status !== "sending" ? "#2196f3" : "#aaa",
                    color: "white",
                    cursor: fileId && status !== "sending" ? "pointer" : "not-allowed",
                }}
            >
                {fileId ? `Download (${fileName})` : "No File Yet"}
            </button>
        </div>
    );
};

export default FileSender;
