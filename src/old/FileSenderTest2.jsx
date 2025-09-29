import React, { useState, useRef, useContext } from "react";
import { LogContext } from "../contexts/LogContext";

// IndexedDB configuration
const DB_NAME = "FileTransferDB";
const STORE_NAME = "files";
const DB_VERSION = 3;

// IndexedDB helper functions
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const setItem = async (key, value) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

const getItem = async (key) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

const removeItem = async (key) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

// Utility to log to console and push to LogContext
const useLogger = () => {
    const { pushLog } = useContext(LogContext);
    return (msg) => {
        console.log(msg);
        pushLog(msg);
    };
};

const FileSender = () => {
    const [sendProgress, setSendProgress] = useState(0);
    const [assembleProgress, setAssembleProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [chunkCount, setChunkCount] = useState(0);
    const [fileSize, setFileSize] = useState(0);

    // Metadata stored in memory
    const metadataRef = useRef({});
    const log = useLogger();

    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Convert file slice to ArrayBuffer efficiently
    const readSliceAsArrayBuffer = (blobSlice) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blobSlice);
        });
    };

    const sendChunk = async (fileId, index, chunkBlob) => {
        // Always store as ArrayBuffer for consistency and iOS compatibility
        const arrayBuffer = await readSliceAsArrayBuffer(chunkBlob);
        await setItem(`${fileId}-${index}`, arrayBuffer);
        log(`Chunk stored → fileId: ${fileId}, index: ${index}, size: ${arrayBuffer.byteLength} bytes`);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const chunkSize = 512 * 1024; // 512KB per chunk
        let offset = 0;
        let index = 0;
        const newFileId = Date.now().toString();

        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);
        setFileSize(file.size);

        metadataRef.current[newFileId] = {
            name: file.name,
            totalChunks: 0,
            type: file.type,
            totalSize: file.size
        };

        try {
            const chunkPromises = [];
            let batchCount = 0;

            while (offset < file.size) {
                const slice = file.slice(offset, offset + chunkSize);
                const chunkPromise = sendChunk(newFileId, index, slice);
                chunkPromises.push(chunkPromise);

                offset += chunkSize;
                index++;
                metadataRef.current[newFileId].totalChunks = index;

                const progress = Math.min(100, Math.round((offset / file.size) * 100));
                setSendProgress(progress);

                // Process in small batches to avoid overwhelming IndexedDB
                batchCount++;
                if (batchCount >= 3) {
                    await Promise.all(chunkPromises);
                    chunkPromises.length = 0;
                    batchCount = 0;

                    // Yield to main thread
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            // Process any remaining chunks
            if (chunkPromises.length > 0) {
                await Promise.all(chunkPromises);
            }

            setChunkCount(index);
            setStatus("completed");
            log(`✅ File saved in DB → fileId: ${newFileId}, totalChunks: ${index}, size: ${file.size} bytes`);

        } catch (error) {
            log(`❌ Error saving file: ${error.message}`);
            setStatus("error");
        }
    };

    const handleDownload = async () => {
        if (!fileId) {
            alert("No file available for download");
            return;
        }

        const metadata = metadataRef.current[fileId];
        if (!metadata) return alert("No metadata found!");

        const totalChunks = metadata.totalChunks;
        setAssembleProgress(0);
        setStatus("assembling");

        try {
            const chunks = [];
            let totalSize = 0;

            for (let i = 0; i < totalChunks; i++) {
                const chunkData = await getItem(`${fileId}-${i}`);

                if (chunkData) {
                    if (isIos) {
                        // For iOS: Convert ArrayBuffer to Blob immediately to avoid memory issues
                        const blobChunk = new Blob([chunkData]);
                        chunks.push(blobChunk);
                        totalSize += blobChunk.size;
                    } else {
                        // For other platforms: Use ArrayBuffer directly
                        chunks.push(chunkData);
                        totalSize += chunkData.byteLength;
                    }
                } else {
                    log(`⚠️ Missing chunk ${i} for file ${fileId}`);
                }

                // Cleanup chunk from DB immediately after retrieval
                removeItem(`${fileId}-${i}`).catch(err => {
                    console.warn(`Failed to remove chunk ${fileId}-${i}:`, err);
                });

                // Update progress
                const progress = Math.min(100, Math.round(((i + 1) / totalChunks) * 100));
                setAssembleProgress(progress);

                // Yield to main thread periodically to prevent iOS crashes
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            log(`📊 Retrieved ${chunks.length}/${totalChunks} chunks, total size: ${totalSize} bytes`);

            // Create final blob - Blob constructor handles both Blobs and ArrayBuffers
            const assembledBlob = isIos
                ? new Blob(chunks, { type: metadata.type || "application/octet-stream" })
                : new Blob(chunks, { type: metadata.type || "application/octet-stream" });

            // Verify final size
            if (assembledBlob.size !== totalSize) {
                log(`⚠️ Size discrepancy: chunks total ${totalSize}, blob size ${assembledBlob.size}`);
            }

            log(`✅ Assembled file: ${assembledBlob.size} bytes`);

            // Create download
            const url = URL.createObjectURL(assembledBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = metadata.name || "downloaded_file";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            log(`⬇️ Downloaded: ${metadata.name}, size: ${assembledBlob.size} bytes`);

            // Clear chunks array
            chunks.length = 0;

            // Reset state
            delete metadataRef.current[fileId];
            setFileId(null);
            setFileName(null);
            setFileSize(0);
            setSendProgress(0);
            setAssembleProgress(0);
            setStatus("idle");

        } catch (error) {
            log(`❌ Error downloading file: ${error.message}`);
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

            {/* File Info */}
            {fileSize > 0 && (
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                    File: {fileName} ({Math.round(fileSize / (1024 * 1024))} MB)
                    {isIos && " [iOS Mode: ArrayBuffer → Blob]"}
                </p>
            )}

            {/* Sending Progress */}
            <div style={{ marginTop: "10px" }}>
                <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                    <div
                        style={{
                            height: "100%",
                            width: `${sendProgress}%`,
                            background: "#4caf50",
                            transition: "width 0.2s",
                        }}
                    ></div>
                </div>
                <p style={{ marginTop: "6px", fontSize: "14px" }}>
                    {status === "sending" && `Sending... ${sendProgress}% (${chunkCount} chunks)`}
                    {status === "completed" && `Ready to download - ${chunkCount} chunks`}
                </p>
            </div>

            {/* Assembling Progress */}
            {status === "assembling" && (
                <div style={{ marginTop: "10px" }}>
                    <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${assembleProgress}%`,
                                background: "#ff9800",
                                transition: "width 0.2s",
                            }}
                        ></div>
                    </div>
                    <p style={{ marginTop: "6px", fontSize: "14px" }}>
                        Assembling... {assembleProgress}%
                    </p>
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