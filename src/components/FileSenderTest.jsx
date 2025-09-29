import React, { useState, useContext, useEffect } from "react";
import { LogContext } from "../contexts/LogContext";
import {
    createFileRecord,
    saveFileChunk,
    downloadFile,
    setChunkUtilLogger,
    deleteDatabase
} from "../utils/chunkUtil";

const CHUNK_SIZE = 256 * 1024; // 256KB

const FileSender = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileId, setFileId] = useState(null);
    const [storeProgress, setStoreProgress] = useState(0);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [status, setStatus] = useState("idle"); // idle, storing, ready, downloading, complete, error
    const [isProcessing, setIsProcessing] = useState(false);

    const { pushLog } = useContext(LogContext);

    const log = (message) => {
        console.log(message);
        pushLog(message);
    };

    useEffect(() => {
        setChunkUtilLogger(log);
    }, []);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setStoreProgress(0);
        setDownloadProgress(0);
        setStatus("idle");
        setFileId(null);

        log(`📄 Selected: ${file.name} (${formatFileSize(file.size)})`);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' bytes';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    };

    const handleStartProcessing = async () => {
        if (!selectedFile || isProcessing) return;

        setIsProcessing(true);
        setStatus("storing");

        const newFileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setFileId(newFileId);

        try {
            log(`🔄 Starting file processing...`);
            await createFileRecord(newFileId, selectedFile.name, selectedFile.size);

            const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
            let processedChunks = 0;

            log(`✂️ Splitting into ${totalChunks} chunks...`);

            // Process file in chunks
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
                const chunk = selectedFile.slice(start, end);

                const arrayBuffer = await chunk.arrayBuffer();
                await saveFileChunk(newFileId, arrayBuffer, chunkIndex);

                processedChunks++;

                // Update progress
                const progress = Math.round((processedChunks / totalChunks) * 100);
                setStoreProgress(progress);

                // Log progress
                if (progress % 10 === 0 || processedChunks === totalChunks) {
                    log(`💾 Stored ${processedChunks}/${totalChunks} chunks (${progress}%)`);
                }

                // Allow UI updates
                if (chunkIndex % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            setStatus("ready");
            log(`✅ File processing complete! Ready to download.`);

        } catch (error) {
            log(`❌ Error: ${error.message}`);
            setStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = async () => {
        if (!fileId || status !== "ready") return;

        setIsProcessing(true);
        setStatus("downloading");

        try {
            log(`⬇️ Starting download...`);

            await downloadFile(fileId, (progress) => {
                setDownloadProgress(progress);

                if (progress % 20 === 0 || progress === 100) {
                    log(`📥 Download progress: ${progress}%`);
                }
            });

            setStatus("complete");
            log(`🎉 Download completed successfully!`);

            // Reset after successful download
            setTimeout(() => {
                setSelectedFile(null);
                setFileId(null);
                setStoreProgress(0);
                setDownloadProgress(0);
                setStatus("idle");
            }, 2000);

        } catch (error) {
            log(`❌ Download failed: ${error.message}`);
            setStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setFileId(null);
        setStoreProgress(0);
        setDownloadProgress(0);
        setStatus("idle");
        setIsProcessing(false);
        log(`🔄 Reset complete`);
    };

    const handleClearDatabase = async () => {
        try {
            await deleteDatabase();
            log(`🗑️ Database cleared successfully`);
            handleReset();
        } catch (error) {
            log(`❌ Failed to clear database: ${error.message}`);
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case "storing": return "#f39c12";
            case "ready": return "#27ae60";
            case "downloading": return "#3498db";
            case "complete": return "#2ecc71";
            case "error": return "#e74c3c";
            default: return "#95a5a6";
        }
    };

    const getStatusMessage = () => {
        switch (status) {
            case "idle": return "Select a file to begin";
            case "storing": return `Processing file... ${storeProgress}%`;
            case "ready": return "Ready to download";
            case "downloading": return `Downloading... ${downloadProgress}%`;
            case "complete": return "Download complete!";
            case "error": return "An error occurred";
            default: return "Ready";
        }
    };

    return (
        <div style={{
            padding: "20px",
            maxWidth: "500px",
            margin: "0 auto",
            fontFamily: "system-ui, sans-serif"
        }}>
            <h1 style={{ textAlign: "center", marginBottom: "30px", color: "#2c3e50" }}>
                File Transfer
            </h1>

            {/* File Selection */}
            <div style={{ marginBottom: "20px" }}>
                <input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    style={{
                        width: "100%",
                        padding: "10px",
                        border: "2px dashed #bdc3c7",
                        borderRadius: "8px",
                        background: isProcessing ? "#ecf0f1" : "white"
                    }}
                />
            </div>

            {/* File Info */}
            {selectedFile && (
                <div style={{
                    padding: "15px",
                    background: "#ecf0f1",
                    borderRadius: "8px",
                    marginBottom: "15px"
                }}>
                    <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                        {selectedFile.name}
                    </div>
                    <div style={{ color: "#7f8c8d", fontSize: "14px" }}>
                        Size: {formatFileSize(selectedFile.size)}
                    </div>
                    {fileId && (
                        <div style={{ color: "#7f8c8d", fontSize: "12px", marginTop: "5px" }}>
                            ID: {fileId}
                        </div>
                    )}
                </div>
            )}

            {/* Progress Bars */}
            {status === "storing" && (
                <div style={{ marginBottom: "15px" }}>
                    <div style={{
                        height: "20px",
                        background: "#ecf0f1",
                        borderRadius: "10px",
                        overflow: "hidden"
                    }}>
                        <div style={{
                            height: "100%",
                            width: `${storeProgress}%`,
                            background: "#f39c12",
                            transition: "width 0.3s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold"
                        }}>
                            {storeProgress}%
                        </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: "5px", color: "#7f8c8d" }}>
                        Processing file...
                    </div>
                </div>
            )}

            {status === "downloading" && (
                <div style={{ marginBottom: "15px" }}>
                    <div style={{
                        height: "20px",
                        background: "#ecf0f1",
                        borderRadius: "10px",
                        overflow: "hidden"
                    }}>
                        <div style={{
                            height: "100%",
                            width: `${downloadProgress}%`,
                            background: "#3498db",
                            transition: "width 0.3s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold"
                        }}>
                            {downloadProgress}%
                        </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: "5px", color: "#7f8c8d" }}>
                        Downloading...
                    </div>
                </div>
            )}

            {/* Status */}
            <div style={{
                padding: "15px",
                background: getStatusColor(),
                color: "white",
                borderRadius: "8px",
                textAlign: "center",
                marginBottom: "15px",
                fontWeight: "bold"
            }}>
                {getStatusMessage()}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {selectedFile && status === "idle" && (
                    <button
                        onClick={handleStartProcessing}
                        disabled={isProcessing}
                        style={{
                            flex: 1,
                            padding: "12px",
                            background: "#e67e22",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "bold"
                        }}
                    >
                        Start Processing
                    </button>
                )}

                {status === "ready" && (
                    <button
                        onClick={handleDownload}
                        disabled={isProcessing}
                        style={{
                            flex: 1,
                            padding: "12px",
                            background: "#27ae60",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "bold"
                        }}
                    >
                        Download File
                    </button>
                )}

                {(selectedFile || fileId) && (
                    <button
                        onClick={handleReset}
                        disabled={isProcessing}
                        style={{
                            padding: "12px 20px",
                            background: "#95a5a6",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer"
                        }}
                    >
                        Reset
                    </button>
                )}

                <button
                    onClick={handleClearDatabase}
                    style={{
                        padding: "12px 20px",
                        background: "#e74c3c",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer"
                    }}
                >
                    Clear DB
                </button>
            </div>

            {/* Info */}
            <div style={{
                marginTop: "20px",
                padding: "10px",
                background: "#d5dbdb",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#2c3e50"
            }}>
                <div><strong>Chunk Size:</strong> 256KB</div>
                <div><strong>Max File Size:</strong> 10GB+</div>
                <div><strong>Platform:</strong> iOS & Android Optimized</div>
            </div>
        </div>
    );
};

export default FileSender;