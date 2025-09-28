import React, { useState, useContext, useEffect } from "react";
import { LogContext } from "../contexts/LogContext";
import {
    createStore,
    saveChunk,
    downloadFile,
    setChunkUtilLogger,
    clearFileData
} from "../utils/chunkUtil";

const CHUNK_SIZE = 256 * 1024; // 256KB

const FileSender = () => {
    const [currentFile, setCurrentFile] = useState(null);
    const [fileId, setFileId] = useState(null);
    const [storeProgress, setStoreProgress] = useState(0);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [status, setStatus] = useState("idle"); // idle, storing, ready, downloading, error
    const [isProcessing, setIsProcessing] = useState(false);

    const { pushLog } = useContext(LogContext);

    // Enhanced logger that ensures all messages go to UI
    const log = (message) => {
        console.log(message);
        pushLog(message);
    };

    // Setup chunkUtil logger
    useEffect(() => {
        setChunkUtilLogger(log);
    }, []);

    // Handle file selection
    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Reset state
        setCurrentFile(file);
        setStoreProgress(0);
        setDownloadProgress(0);
        setStatus("idle");
        setFileId(null);

        log(`📁 Selected: ${file.name} (${formatFileSize(file.size)})`);

        // Auto-start processing
        await handleStartProcessing(file);
    };

    // Format file size for display
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Process the file and store chunks
    const handleStartProcessing = async (file) => {
        if (!file || isProcessing) return;

        setIsProcessing(true);
        setStatus("storing");

        const newFileId = `file_${Date.now()}`;
        setFileId(newFileId);

        try {
            log(`🚀 Starting file processing...`);
            await createStore(newFileId, file.name);

            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let processedChunks = 0;

            log(`🔪 Splitting file into ${totalChunks} chunks of ${CHUNK_SIZE / 1024}KB each`);

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                // Convert to ArrayBuffer
                const arrayBuffer = await chunk.arrayBuffer();

                // Store the chunk
                await saveChunk(newFileId, arrayBuffer, chunkIndex);

                processedChunks++;

                // Update progress
                const progress = Math.round((processedChunks / totalChunks) * 100);
                setStoreProgress(progress);

                // Log every 5% or for small files, every chunk
                if (progress % 5 === 0 || totalChunks < 20) {
                    log(`💾 Stored chunk ${processedChunks}/${totalChunks} (${progress}%)`);
                }

                // Yield to UI to prevent blocking
                if (chunkIndex % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            setStatus("ready");
            log(`✅ File processing complete! Ready for download.`);

        } catch (error) {
            log(`❌ Error processing file: ${error.message}`);
            setStatus("error");

            // Clean up on error
            if (newFileId) {
                await clearFileData(newFileId);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle download
    const handleDownload = async () => {
        if (!fileId || status !== "ready") return;

        setIsProcessing(true);
        setStatus("downloading");
        setDownloadProgress(0);

        try {
            log(`⬇️ Starting download process...`);

            await downloadFile(fileId, (progress, processed, total) => {
                setDownloadProgress(progress);

                // Log key progress points
                if (progress % 10 === 0 || processed === total) {
                    log(`📦 Download: ${progress}% (${processed}/${total} chunks)`);
                }
            });

            log(`🎉 Download completed successfully!`);

            // Reset for next file
            setStatus("idle");
            setCurrentFile(null);
            setFileId(null);
            setStoreProgress(0);
            setDownloadProgress(0);

        } catch (error) {
            log(`❌ Download failed: ${error.message}`);
            setStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle cancel/clear
    const handleClear = async () => {
        if (fileId) {
            await clearFileData(fileId);
            log(`🧹 Cleared stored data for file ${fileId}`);
        }

        setCurrentFile(null);
        setFileId(null);
        setStoreProgress(0);
        setDownloadProgress(0);
        setStatus("idle");
        setIsProcessing(false);
    };

    const getStatusMessage = () => {
        switch (status) {
            case "idle": return "Select a file to begin";
            case "storing": return `Processing file... ${storeProgress}%`;
            case "ready": return "Ready to download";
            case "downloading": return `Downloading... ${downloadProgress}%`;
            case "error": return "An error occurred";
            default: return "Ready";
        }
    };

    return (
        <div style={{
            padding: "20px",
            fontFamily: "Arial, sans-serif",
            maxWidth: "600px",
            margin: "0 auto"
        }}>
            <h2 style={{ marginBottom: "20px", color: "#333" }}>
                File Transfer (iOS Optimized)
            </h2>

            {/* File Input */}
            <div style={{ marginBottom: "20px" }}>
                <input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    style={{
                        padding: "10px",
                        border: "2px dashed #ccc",
                        borderRadius: "8px",
                        width: "100%",
                        backgroundColor: isProcessing ? "#f5f5f5" : "white"
                    }}
                />
            </div>

            {/* File Info */}
            {currentFile && (
                <div style={{
                    padding: "15px",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    marginBottom: "15px",
                    border: "1px solid #e9ecef"
                }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#495057" }}>
                        {currentFile.name}
                    </h4>
                    <p style={{ margin: 0, color: "#6c757d", fontSize: "14px" }}>
                        Size: {formatFileSize(currentFile.size)}
                        {fileId && ` • ID: ${fileId}`}
                    </p>
                </div>
            )}

            {/* Storage Progress */}
            {status === "storing" && (
                <div style={{ marginBottom: "15px" }}>
                    <div style={{
                        height: "20px",
                        backgroundColor: "#e9ecef",
                        borderRadius: "10px",
                        overflow: "hidden"
                    }}>
                        <div style={{
                            height: "100%",
                            width: `${storeProgress}%`,
                            backgroundColor: "#28a745",
                            transition: "width 0.3s ease",
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
                    <p style={{
                        margin: "8px 0 0 0",
                        fontSize: "14px",
                        color: "#495057",
                        textAlign: "center"
                    }}>
                        Processing file... {storeProgress}%
                    </p>
                </div>
            )}

            {/* Download Progress */}
            {status === "downloading" && (
                <div style={{ marginBottom: "15px" }}>
                    <div style={{
                        height: "20px",
                        backgroundColor: "#e9ecef",
                        borderRadius: "10px",
                        overflow: "hidden"
                    }}>
                        <div style={{
                            height: "100%",
                            width: `${downloadProgress}%`,
                            backgroundColor: "#007bff",
                            transition: "width 0.3s ease",
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
                    <p style={{
                        margin: "8px 0 0 0",
                        fontSize: "14px",
                        color: "#495057",
                        textAlign: "center"
                    }}>
                        Downloading... {downloadProgress}%
                    </p>
                </div>
            )}

            {/* Status Message */}
            <div style={{
                padding: "12px",
                backgroundColor: status === "error" ? "#f8d7da" :
                    status === "ready" ? "#d1ecf1" : "#e2e3e5",
                border: `1px solid ${
                    status === "error" ? "#f5c6cb" :
                        status === "ready" ? "#bee5eb" : "#d6d8db"
                }`,
                borderRadius: "6px",
                marginBottom: "15px",
                textAlign: "center"
            }}>
                <p style={{
                    margin: 0,
                    color: status === "error" ? "#721c24" :
                        status === "ready" ? "#0c5460" : "#383d41",
                    fontWeight: status === "error" ? "bold" : "normal"
                }}>
                    {getStatusMessage()}
                </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
                {status === "ready" && (
                    <button
                        onClick={handleDownload}
                        disabled={isProcessing}
                        style={{
                            flex: 1,
                            padding: "12px 20px",
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "16px",
                            fontWeight: "bold",
                            opacity: isProcessing ? 0.6 : 1
                        }}
                    >
                        📥 Download File
                    </button>
                )}

                {(currentFile || fileId) && (
                    <button
                        onClick={handleClear}
                        disabled={isProcessing}
                        style={{
                            padding: "12px 20px",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "16px",
                            opacity: isProcessing ? 0.6 : 1
                        }}
                    >
                        🗑️ Clear
                    </button>
                )}
            </div>

            {/* Platform Info */}
            <div style={{
                marginTop: "20px",
                padding: "10px",
                backgroundColor: "#fff3cd",
                border: "1px solid #ffeaa7",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#856404"
            }}>
                <strong>Platform:</strong> {/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'iOS' : 'Other'}
                <br />
                <strong>Chunk Size:</strong> 256KB
                <br />
                <strong>Optimized for:</strong> Large files (up to 10GB)
            </div>
        </div>
    );
};

export default FileSender;