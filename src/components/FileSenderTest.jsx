import React, { useState, useContext } from "react";
import { LogContext } from "../contexts/LogContext";
import {
    deleteDatabase,
    createStore,
    saveChunk,
    getBlob,
    clearChunks,
    getName,
    flush,
    getInfo, refreshIOSStorage, downloadFile
} from "../utils/chunkUtil";

const useLogger = () => {
    const { pushLog } = useContext(LogContext);
    return (msg) => {
        console.log(msg);
        pushLog(msg);
    };
};

const CHUNK_SIZE = 256 * 1024; // 256 KB
const getOptimalBatch = (fileSizeMB) => (fileSizeMB >= 8 ? 8 : fileSizeMB);
const ANDROID_REGEX = /Android/i;
const isAndroid = ANDROID_REGEX.test(navigator.userAgent);




const FileSender = () => {
    const [sendProgress, setSendProgress] = useState(0);
    const [assembleProgress, setAssembleProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [fileSize, setFileSize] = useState(0);

    const log = useLogger();

    const processBuffer = async (buffer, fileSize, offsetStart = 0, newFileId) => {
        let offset = offsetStart;
        let lastPercent = Math.floor((offset / fileSize) * 100);

        for (let i = 0; i < buffer.byteLength; i += CHUNK_SIZE) {
            const end = Math.min(i + CHUNK_SIZE, buffer.byteLength);
            const chunk = buffer.slice(i, end);
            await saveChunk(newFileId, chunk);
            offset += chunk.byteLength;

            const percent = Math.floor((offset / fileSize) * 100);
            if (percent !== lastPercent) {
                lastPercent = percent;
                setSendProgress(percent);
                log(`Read ${chunk.byteLength} bytes, Progress: ${percent}%`);
            }
        }

        return offset;
    };

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

            if (isAndroid) {
                const fileSizeMB = file.size / (1024 * 1024);
                const batchSizeMB = getOptimalBatch(fileSizeMB);
                const batchBytes = Math.min(batchSizeMB * 1024 * 1024, file.size);
                log(`Using Android batch reading (${batchSizeMB} MB batches)`);
                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + batchBytes, file.size));
                    const buffer = await slice.arrayBuffer();
                    offset = await processBuffer(buffer, file.size, offset, newFileId);

                    // Yield for UI
                    await new Promise((r) => setTimeout(r, 0));
                }
            } else {
                log("Using sequential reading (256 KB chunks)");
                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
                    const buffer = await slice.arrayBuffer();
                    offset = await processBuffer(buffer, file.size, offset, newFileId);
                }
            }

            await flush(newFileId);
            setSendProgress(100);

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
            // Start streaming download
            await downloadFile(fileId, (processed, total) => {
                const percent = Math.floor((processed / total) * 100);
                setAssembleProgress(percent);
            });

            log(`⬇️ Download completed: ${fileId}`);

            // Reset state
            setFileId(null);
            setFileName(null);
            setFileSize(0);
            setSendProgress(0);
            setAssembleProgress(0);
            setStatus("idle");

            // Optional: inspect DB after deletion
            const afterInfo = await getInfo(fileId);
            log("After clear:\n" + JSON.stringify(afterInfo, null, 2));

            const refreshed = await refreshIOSStorage();
            if (refreshed) log("iOS storage view refreshed successfully.");
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
