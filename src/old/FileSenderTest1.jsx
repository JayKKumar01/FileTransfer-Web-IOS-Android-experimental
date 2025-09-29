import React, { useState, useRef, useContext } from "react";
import { LogContext } from "../contexts/LogContext";

// IndexedDB configuration
const DB_NAME = "FileTransferDB";
const STORE_NAME = "files";
const DB_VERSION = 2;

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

    // Metadata stored in memory
    const metadataRef = useRef({});
    const log = useLogger();

    // Optimized: Directly read file slice as ArrayBuffer
    const readSliceAsArrayBuffer = (blobSlice) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blobSlice);
        });
    };

    // Save single chunk as ArrayBuffer
    const sendChunk = async (fileId, index, chunkBlob) => {
        // Convert Blob slice to ArrayBuffer immediately to reduce memory overhead :cite[9]
        const arrayBuffer = await readSliceAsArrayBuffer(chunkBlob);
        await setItem(`${fileId}-${index}`, arrayBuffer);
        log(`Chunk stored → fileId: ${fileId}, index: ${index}, size: ${arrayBuffer.byteLength} bytes`);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const chunkSize = 256 * 1024; // 256KB per chunk
        let offset = 0;
        let index = 0;
        const newFileId = Date.now().toString();

        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);
        metadataRef.current[newFileId] = {
            name: file.name,
            totalChunks: 0,
            type: file.type
        };

        try {
            while (offset < file.size) {
                const slice = file.slice(offset, offset + chunkSize);
                await sendChunk(newFileId, index, slice);

                offset += chunkSize;
                index++;
                metadataRef.current[newFileId].totalChunks = index;

                const progress = Math.min(100, Math.round((offset / file.size) * 100));
                setSendProgress(progress);

                // Yield to main thread periodically
                if (index % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            setChunkCount(index);
            setStatus("completed");
            log(`✅ File saved in DB → fileId: ${newFileId}, totalChunks: ${index}`);
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
            const chunkPromises = [];
            const cleanupPromises = [];

            // Collect all chunk retrieval promises
            for (let i = 0; i < totalChunks; i++) {
                chunkPromises.push(getItem(`${fileId}-${i}`));
            }

            // Get all chunks
            const chunks = await Promise.all(chunkPromises);

            // Optimized: Create Blob directly from ArrayBuffers :cite[5]
            const assembledBlob = new Blob(chunks, {
                type: metadata.type || "application/octet-stream"
            });

            // Schedule cleanup of all chunks
            for (let i = 0; i < totalChunks; i++) {
                cleanupPromises.push(removeItem(`${fileId}-${i}`).catch(err => {
                    console.warn(`Failed to remove chunk ${fileId}-${i}:`, err);
                }));
            }

            setAssembleProgress(100);

            // Create download link
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

            log(`⬇️ Downloaded fileId: ${fileId}, name: ${metadata.name}`);

            // Wait for cleanup to complete
            await Promise.allSettled(cleanupPromises);

            // Reset state
            delete metadataRef.current[fileId];
            setFileId(null);
            setFileName(null);
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
                    {status === "sending" && `Sending... ${sendProgress}%`}
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