import React, { useState, useContext, useEffect, useRef } from "react";
import { LogContext } from "../contexts/LogContext";
import {
    createStore,
    saveChunk,
    getName,
    flush,
    getInfo,
    downloadFile,
    downloadFileManual,
    setChunkUtilLogger
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
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [fileSize, setFileSize] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    const log = useLogger();
    const logRef = useRef(log);

    // Update ref when log changes
    useEffect(() => {
        logRef.current = log;
    }, [log]);

    // Set up the chunkUtil logger when component mounts
    useEffect(() => {
        setChunkUtilLogger((message) => {
            logRef.current(message);
        });
    }, []);

    // Enhanced logging function that ensures all logs go through
    const enhancedLog = (message) => {
        logRef.current(message);
    };

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
            }
        }

        return offset;
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset any previous download state
        setIsDownloading(false);
        setDownloadProgress(0);

        const newFileId = Date.now().toString();
        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);
        setFileSize(file.size);

        enhancedLog(`📁 Selected file: ${file.name} (${Math.round(file.size / (1024 * 1024))} MB)`);

        try {
            enhancedLog(`🗃️ Creating store for fileId: ${newFileId}`);
            await createStore(newFileId, file.name);

            let offset = 0;

            if (isAndroid) {
                const fileSizeMB = file.size / (1024 * 1024);
                const batchSizeMB = getOptimalBatch(fileSizeMB);
                const batchBytes = Math.min(batchSizeMB * 1024 * 1024, file.size);
                enhancedLog(`🤖 Using Android batch reading (${batchSizeMB} MB batches)`);

                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + batchBytes, file.size));
                    const buffer = await slice.arrayBuffer();
                    offset = await processBuffer(buffer, file.size, offset, newFileId);

                    // Yield for UI
                    await new Promise((r) => setTimeout(r, 0));
                }
            } else {
                enhancedLog(`🖥️ Using sequential reading (256 KB chunks)`);
                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
                    const buffer = await slice.arrayBuffer();
                    offset = await processBuffer(buffer, file.size, offset, newFileId);
                }
            }

            enhancedLog(`🧹 Flushing remaining chunks...`);
            await flush(newFileId);
            setSendProgress(100);

            setStatus("ready");
            enhancedLog(`✅ File stored → fileId: ${newFileId}, size: ${file.size} bytes`);

            // Log storage info
            enhancedLog(`📊 Getting storage info...`);
            const info = await getInfo(newFileId);
            enhancedLog("Storage info:\n" + JSON.stringify(info, null, 2));
        } catch (err) {
            enhancedLog(`❌ Error storing file: ${err.message}`);
            setStatus("error");
        }
    };

    const handleDownload = async () => {
        if (!fileId || isDownloading) return;

        setIsDownloading(true);
        setDownloadProgress(0);
        setStatus("downloading");

        enhancedLog(`🚀 Starting download process...`);

        try {
            const name = await getName(fileId);
            enhancedLog(`⬇️ Starting download: ${name}`);

            let lastPercent = 0;
            let progressLogCount = 0;

            // Use manual download for better memory control with large files
            await downloadFileManual(fileId, (processed, total) => {
                const percent = Math.floor((processed / total) * 100);
                if (percent !== lastPercent) {
                    setDownloadProgress(percent);

                    // Log progress at key intervals to avoid spam
                    if (percent % 10 === 0 || processed === total || processed === 1) {
                        enhancedLog(`📦 Download Progress: ${percent}% (${processed}/${total} records)`);
                        progressLogCount++;
                    }
                }
                lastPercent = percent;
            });

            enhancedLog(`✅ Download completed: ${name}`);
            enhancedLog(`📈 Total progress updates logged: ${progressLogCount}`);

            // Clean up and reset state
            await resetState();

        } catch (err) {
            enhancedLog(`❌ Error downloading file: ${err.message}`);
            setStatus("error");
            setIsDownloading(false);
        }
    };

    const handleCancelDownload = () => {
        enhancedLog(`⏹️ Download cancellation requested`);
        setIsDownloading(false);
        setStatus("ready");
    };

    const resetState = async () => {
        enhancedLog(`🔄 Resetting application state...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        setFileId(null);
        setFileName(null);
        setFileSize(0);
        setSendProgress(0);
        setDownloadProgress(0);
        setStatus("idle");
        setIsDownloading(false);

        enhancedLog(`🔄 Application state reset complete`);
    };

    const getStatusMessage = () => {
        switch (status) {
            case "sending":
                return `Storing... ${sendProgress}%`;
            case "ready":
                return "Ready to download";
            case "downloading":
                return `Downloading... ${downloadProgress}%`;
            case "completed":
                return "Download completed!";
            case "error":
                return "Error occurred";
            default:
                return "Select a file to begin";
        }
    };

    const getButtonConfig = () => {
        if (status === "downloading") {
            return {
                text: "Cancel Download",
                onClick: handleCancelDownload,
                bgColor: "#ff5722",
                disabled: false
            };
        } else if (fileId && status !== "sending") {
            return {
                text: `Download ${fileName}`,
                onClick: handleDownload,
                bgColor: "#2196f3",
                disabled: isDownloading
            };
        } else {
            return {
                text: "No File Available",
                onClick: null,
                bgColor: "#aaa",
                disabled: true
            };
        }
    };

    const buttonConfig = getButtonConfig();

    return (
        <div style={{ padding: "16px", fontFamily: "Arial" }}>
            <input
                type="file"
                onChange={handleFileSelect}
                disabled={status === "sending" || status === "downloading"}
                style={{
                    marginBottom: "12px",
                    padding: "6px",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    opacity: (status === "sending" || status === "downloading") ? 0.6 : 1
                }}
            />

            {fileSize > 0 && (
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                    File: {fileName} ({Math.round(fileSize / (1024 * 1024))} MB)
                </p>
            )}

            {/* Storage Progress */}
            {status === "sending" && (
                <div style={{ marginTop: "10px" }}>
                    <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${sendProgress}%`, background: "#4caf50", transition: "width 0.2s" }} />
                    </div>
                    <p style={{ marginTop: "6px", fontSize: "14px" }}>
                        Storing file... {sendProgress}%
                    </p>
                </div>
            )}

            {/* Download Progress */}
            {status === "downloading" && (
                <div style={{ marginTop: "10px" }}>
                    <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${downloadProgress}%`, background: "#ff9800", transition: "width 0.2s" }} />
                    </div>
                    <p style={{ marginTop: "6px", fontSize: "14px" }}>
                        Downloading... {downloadProgress}%
                    </p>
                </div>
            )}

            {/* Status Message */}
            <p style={{
                marginTop: "10px",
                fontSize: "14px",
                color: status === "error" ? "#f44336" : "#666",
                fontWeight: status === "error" ? "bold" : "normal"
            }}>
                {getStatusMessage()}
            </p>

            {/* Action Button */}
            <button
                onClick={buttonConfig.onClick}
                disabled={buttonConfig.disabled}
                style={{
                    marginTop: "12px",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "6px",
                    background: buttonConfig.bgColor,
                    color: "white",
                    cursor: buttonConfig.disabled ? "not-allowed" : "pointer",
                    opacity: buttonConfig.disabled ? 0.6 : 1
                }}
            >
                {buttonConfig.text}
            </button>

            {/* File Info */}
            {fileId && status === "ready" && (
                <div style={{ marginTop: "10px", padding: "10px", background: "#f5f5f5", borderRadius: "6px" }}>
                    <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>
                        File ID: {fileId}
                    </p>
                </div>
            )}

            {/* Debug Info */}
            <div style={{ marginTop: "15px", padding: "10px", background: "#f0f8ff", borderRadius: "6px", border: "1px solid #d1e7ff" }}>
                <p style={{ fontSize: "12px", color: "#1976d2", margin: "0 0 5px 0", fontWeight: "bold" }}>
                    Debug Information:
                </p>
                <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>
                    Status: <strong>{status}</strong>
                </p>
                <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>
                    File ID: <strong>{fileId || "None"}</strong>
                </p>
                <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>
                    Platform: <strong>{isAndroid ? "Android" : "Non-Android"}</strong>
                </p>
            </div>
        </div>
    );
};

export default FileSender;