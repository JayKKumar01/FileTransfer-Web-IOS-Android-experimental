import React, { useState, useCallback, useRef } from "react";

const IndexedDBFileHandler = () => {
    const [status, setStatus] = useState("");
    const [currentFileId, setCurrentFileId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    const DB_NAME = "fileChunksDB";
    const STORE_NAME = "fileChunks";
    const DB_VERSION = 1;

    // Memoized database opening function
    const openDB = useCallback(() => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    store.createIndex("fileId", "fileId", { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("Database is blocked"));
        });
    }, []);

    // Optimized chunk storage with error handling
    const storeChunk = useCallback(async (fileId, index, chunk) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);

            store.put({
                id: `${fileId}-${index}`,
                fileId,
                index,
                chunk,
                timestamp: Date.now()
            });
        });
    }, [openDB]);

    // Improved file deletion with better error handling
    const deleteCurrentFileData = useCallback(async () => {
        if (!currentFileId) {
            setStatus("No file data to delete!");
            return;
        }

        setIsProcessing(true);
        setStatus("Deleting file data...");

        try {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const index = store.index("fileId");
                const range = IDBKeyRange.only(currentFileId);

                const request = index.openCursor(range);

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };

                request.onerror = () => reject(request.error);
            });

            setStatus("File data deleted successfully!");
            setCurrentFileId(null);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error) {
            console.error("Delete error:", error);
            setStatus(`Error deleting data: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    }, [currentFileId, openDB]);

    // Clear all database data (additional feature)
    const clearAllData = useCallback(async () => {
        setIsProcessing(true);
        setStatus("Clearing all data...");

        try {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            setStatus("All data cleared successfully!");
            setCurrentFileId(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error) {
            console.error("Clear all error:", error);
            setStatus(`Error clearing data: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    }, [openDB]);

    // Optimized file handling with progress tracking
    const handleFile = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setStatus("Processing file...");

        try {
            const fileId = `${file.name}-${file.size}-${file.lastModified}`;
            setCurrentFileId(fileId);

            const chunkSize = 256 * 1024; // 256 KB
            const totalChunks = Math.ceil(file.size / chunkSize);
            let chunksStored = 0;

            setStatus(`Storing chunks... 0/${totalChunks}`);

            // Process chunks with progress updates
            for (let index = 0; index < totalChunks; index++) {
                const offset = index * chunkSize;
                const chunk = file.slice(offset, offset + chunkSize);
                const arrayBuffer = await chunk.arrayBuffer();

                await storeChunk(fileId, index, arrayBuffer);
                chunksStored++;

                // Update progress every 10 chunks or on last chunk
                if (chunksStored % 10 === 0 || chunksStored === totalChunks) {
                    setStatus(`Storing chunks... ${chunksStored}/${totalChunks}`);
                }
            }

            setStatus(`Successfully stored ${chunksStored} chunks for ${file.name}`);
        } catch (error) {
            console.error("File processing error:", error);
            setStatus(`Error processing file: ${error.message}`);
            setCurrentFileId(null);
        } finally {
            setIsProcessing(false);
        }
    }, [storeChunk]);

    const buttonStyle = {
        padding: "10px 16px",
        border: "none",
        borderRadius: "6px",
        cursor: isProcessing ? "not-allowed" : "pointer",
        fontSize: "14px",
        fontWeight: "500",
        transition: "all 0.2s ease",
        opacity: isProcessing ? 0.6 : 1,
    };

    const deleteButtonStyle = {
        ...buttonStyle,
        backgroundColor: "#dc3545",
        color: "white",
    };

    const clearAllButtonStyle = {
        ...buttonStyle,
        backgroundColor: "#6c757d",
        color: "white",
    };

    const primaryButtonStyle = {
        ...buttonStyle,
        backgroundColor: "#007bff",
        color: "white",
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "20px",
                border: "1px solid #e1e5e9",
                borderRadius: "12px",
                maxWidth: "500px",
                margin: "20px auto",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
        >
            <h3 style={{ margin: "0 0 8px 0", color: "#333" }}>
                IndexedDB File Handler
            </h3>

            <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
                Upload files to browser storage. Data persists until manually deleted.
            </p>

            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFile}
                disabled={isProcessing}
                style={{
                    padding: "12px",
                    border: "2px dashed #ddd",
                    borderRadius: "6px",
                    backgroundColor: "#fafafa",
                    cursor: isProcessing ? "not-allowed" : "pointer",
                }}
            />

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                    onClick={deleteCurrentFileData}
                    disabled={isProcessing || !currentFileId}
                    style={deleteButtonStyle}
                    onMouseOver={(e) => {
                        if (!isProcessing && currentFileId) {
                            e.target.style.backgroundColor = "#c82333";
                        }
                    }}
                    onMouseOut={(e) => {
                        if (!isProcessing && currentFileId) {
                            e.target.style.backgroundColor = "#dc3545";
                        }
                    }}
                >
                    Delete Current File
                </button>

                <button
                    onClick={clearAllData}
                    disabled={isProcessing}
                    style={clearAllButtonStyle}
                    onMouseOver={(e) => {
                        if (!isProcessing) {
                            e.target.style.backgroundColor = "#5a6268";
                        }
                    }}
                    onMouseOut={(e) => {
                        if (!isProcessing) {
                            e.target.style.backgroundColor = "#6c757d";
                        }
                    }}
                >
                    Clear All Data
                </button>
            </div>

            <div
                style={{
                    padding: "12px",
                    borderRadius: "6px",
                    backgroundColor: isProcessing ? "#fff3cd" : "#d4edda",
                    border: `1px solid ${isProcessing ? "#ffeaa7" : "#c3e6cb"}`,
                    color: isProcessing ? "#856404" : "#155724",
                    fontSize: "14px",
                    minHeight: "20px",
                }}
            >
                {status || "Select a file to begin..."}
            </div>

            {currentFileId && (
                <div
                    style={{
                        fontSize: "12px",
                        color: "#666",
                        padding: "8px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        wordBreak: "break-all",
                    }}
                >
                    Current File ID: {currentFileId}
                </div>
            )}
        </div>
    );
};

export default IndexedDBFileHandler;