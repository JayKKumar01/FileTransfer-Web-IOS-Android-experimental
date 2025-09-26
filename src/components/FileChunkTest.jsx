import React, { useState, useRef } from "react";

const FileChunkTest = () => {
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [dbReady, setDbReady] = useState(false);
    const [chunkSize, setChunkSize] = useState(64 * 1024);
    const [error, setError] = useState(null);
    const dbRef = useRef(null);
    const fileIdRef = useRef(null);

    // IndexedDB setup
    const openDB = () => {
        return new Promise((resolve, reject) => {
            if (dbRef.current) {
                resolve(dbRef.current);
                return;
            }

            const request = indexedDB.open("TestFileDB-05", 3); // Increased version to 3

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log(`Upgrading database to version ${event.newVersion}`);

                if (!db.objectStoreNames.contains("chunks")) {
                    const store = db.createObjectStore("chunks", { keyPath: "id" });
                    store.createIndex("fileId", "fileId", { unique: false });
                    console.log("Created chunks store and fileId index");
                } else {
                    const tx = event.target.transaction;
                    const store = tx.objectStore("chunks");
                    if (!store.indexNames.contains("fileId")) {
                        store.createIndex("fileId", "fileId", { unique: false });
                        console.log("Created fileId index on existing store");
                    }
                }
            };

            request.onsuccess = (event) => {
                dbRef.current = event.target.result;
                console.log("Database opened successfully");
                resolve(dbRef.current);
            };

            request.onerror = (event) => {
                console.error("Database error:", event.target.error);
                reject(event.target.error);
            };
        });
    };

    const storeChunk = async (fileId, chunkIndex, arrayBuffer) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("chunks", "readwrite");
            const store = tx.objectStore("chunks");

            const chunkData = {
                id: `${fileId}-${chunkIndex}`,
                fileId,
                chunkIndex,
                data: arrayBuffer,
                timestamp: Date.now()
            };

            const request = store.put(chunkData);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };

            tx.onerror = () => {
                reject(tx.error);
            };
        });
    };

    const getChunks = async (fileId) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("chunks", "readonly");
            const store = tx.objectStore("chunks");
            const index = store.index("fileId");

            // Use getAll to get all chunks for this fileId
            const request = index.getAll(IDBKeyRange.only(fileId));

            request.onsuccess = (event) => {
                const results = event.target.result;
                console.log(`Retrieved ${results.length} chunks from database for fileId: ${fileId}`);

                // Sort by chunkIndex to ensure correct order
                results.sort((a, b) => a.chunkIndex - b.chunkIndex);

                // Extract just the data arrays
                const chunks = results.map(chunk => chunk.data);
                resolve(chunks);
            };

            request.onerror = (event) => {
                console.error("Error getting chunks:", event.target.error);
                reject(event.target.error);
            };
        });
    };

    const countChunks = async (fileId) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("chunks", "readonly");
            const store = tx.objectStore("chunks");
            const index = store.index("fileId");

            const request = index.count(IDBKeyRange.only(fileId));

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    };

    const deleteChunks = async (fileId) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("chunks", "readwrite");
            const store = tx.objectStore("chunks");
            const index = store.index("fileId");

            const request = index.openCursor(IDBKeyRange.only(fileId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            tx.oncomplete = () => {
                console.log(`Deleted chunks for fileId: ${fileId}`);
                resolve();
            };

            tx.onerror = () => {
                reject(tx.error);
            };
        });
    };

    const generateFileId = (file) => {
        // Simple but unique file ID based on file properties
        return `file-${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setProgress(0);
            setStatus("idle");
            setError(null);
            setDbReady(false);
            fileIdRef.current = null;
        }
    };

    const handleSaveToIndexedDB = async () => {
        if (!file) return;

        setError(null);
        setStatus("saving");

        try {
            // Clear any existing database connection
            if (dbRef.current) {
                dbRef.current.close();
                dbRef.current = null;
            }

            const totalChunks = Math.ceil(file.size / chunkSize);
            const fileId = generateFileId(file);
            fileIdRef.current = fileId;

            console.log(`Saving file: ${file.name}`);
            console.log(`File size: ${file.size}, Chunk size: ${chunkSize}, Total chunks: ${totalChunks}`);

            // Process chunks sequentially to avoid IndexedDB transaction conflicts
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(file.size, start + chunkSize);
                const chunkBlob = file.slice(start, end);
                const arrayBuffer = await chunkBlob.arrayBuffer();

                await storeChunk(fileId, i, arrayBuffer);

                // Update progress
                const newProgress = ((i + 1) / totalChunks) * 100;
                setProgress(newProgress);

                // Log every 100 chunks or so to avoid console spam
                if (i % 100 === 0 || i === totalChunks - 1) {
                    console.log(`Stored chunk ${i + 1}/${totalChunks} (${newProgress.toFixed(1)}%)`);
                }
            }

            // Verify the count of stored chunks
            const storedCount = await countChunks(fileId);
            console.log(`Expected ${totalChunks} chunks, stored ${storedCount} chunks`);

            if (storedCount !== totalChunks) {
                throw new Error(`Chunk count mismatch after saving. Expected: ${totalChunks}, Stored: ${storedCount}`);
            }

            setStatus("done");
            setDbReady(fileId);
            console.log("File saved successfully!");

        } catch (error) {
            console.error("Error saving file:", error);
            setError(`Error saving file: ${error.message}`);
            setStatus("idle");
        }
    };

    const handleDownload = async () => {
        if (!dbReady || !file) return;

        setError(null);
        setStatus("downloading");

        try {
            console.log("Starting download process...");

            // First, count how many chunks we have
            const chunkCount = await countChunks(dbReady);
            console.log(`Database contains ${chunkCount} chunks for fileId: ${dbReady}`);

            const expectedChunks = Math.ceil(file.size / chunkSize);
            console.log(`Expected chunks: ${expectedChunks}`);

            if (chunkCount !== expectedChunks) {
                throw new Error(`Chunk count mismatch. Expected: ${expectedChunks}, Found in DB: ${chunkCount}. The file may not have been saved completely.`);
            }

            // Now retrieve all chunks
            const chunks = await getChunks(dbReady);
            console.log(`Retrieved ${chunks.length} chunks for reconstruction`);

            // Verify we got the right number
            if (chunks.length !== expectedChunks) {
                throw new Error(`Retrieved chunk count mismatch. Expected: ${expectedChunks}, Got: ${chunks.length}`);
            }

            // Verify total size
            const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
            console.log(`Original size: ${file.size}, Reconstructed size: ${totalSize}`);

            if (totalSize !== file.size) {
                console.warn(`Size mismatch! Original: ${file.size}, Reconstructed: ${totalSize}. Proceeding with download anyway.`);
            }

            // Create blob and download
            const blob = new Blob(chunks, { type: file.type });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = file.name || "downloaded-file";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);

            console.log("File downloaded successfully");

            // Clean up
            await deleteChunks(dbReady);

            setDbReady(false);
            setStatus("idle");
            setProgress(0);

        } catch (error) {
            console.error("Error downloading file:", error);
            setError(`Error downloading file: ${error.message}`);
            setStatus("done");
        }
    };

    const handleReset = () => {
        setFile(null);
        setProgress(0);
        setStatus("idle");
        setDbReady(false);
        setError(null);
        fileIdRef.current = null;

        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = "";
    };

    const clearDatabase = async () => {
        try {
            if (dbRef.current) {
                dbRef.current.close();
                dbRef.current = null;
            }

            const request = indexedDB.deleteDatabase("TestFileDB");
            request.onsuccess = () => {
                console.log("Database cleared successfully");
                setError("Database cleared successfully. Please refresh the page.");
            };
            request.onerror = () => {
                setError("Error clearing database");
            };
        } catch (error) {
            console.error("Error clearing database:", error);
            setError(`Error clearing database: ${error.message}`);
        }
    };

    // Generate chunk size options
    const chunkOptions = [];
    let size = 16 * 1024;
    while (size <= 2 * 1024 * 1024) {
        chunkOptions.push(size);
        size *= 2;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", padding: "10px", maxWidth: "600px", margin: "0 auto" }}>
            <h2>File Chunk Storage Test</h2>

            <input
                type="file"
                onChange={handleFileChange}
                disabled={status === "saving" || status === "downloading"}
            />

            {error && (
                <div style={{ color: "red", padding: "10px", border: "1px solid red", borderRadius: "4px", background: "#ffe6e6" }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {file && (
                <>
                    <div>
                        <label><strong>Chunk Size:</strong> </label>
                        <select
                            value={chunkSize}
                            onChange={(e) => setChunkSize(Number(e.target.value))}
                            disabled={status === "saving" || status === "downloading"}
                        >
                            {chunkOptions.map((cs) => (
                                <option key={cs} value={cs}>
                                    {cs >= 1024 * 1024
                                        ? `${(cs / (1024 * 1024)).toFixed(0)} MB`
                                        : `${(cs / 1024).toFixed(0)} KB`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <strong>File:</strong> {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        <br />
                        <small>Chunk size: {(chunkSize / 1024).toFixed(0)} KB, Total chunks: {Math.ceil(file.size / chunkSize)}</small>
                    </div>

                    <div style={{ width: "100%", background: "#eee", height: "20px", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{
                            width: `${progress}%`,
                            height: "100%",
                            background: progress === 100 ? "#4caf50" : "#2196f3",
                            transition: "width 0.3s ease, background 0.3s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            color: "white",
                            fontWeight: "bold"
                        }}>
                            {progress.toFixed(1)}%
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        {status === "idle" && (
                            <>
                                <button
                                    onClick={handleSaveToIndexedDB}
                                    style={{ padding: "10px 20px", backgroundColor: "#4caf50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                >
                                    Save to IndexedDB
                                </button>
                                <button
                                    onClick={handleReset}
                                    style={{ padding: "10px 20px", backgroundColor: "#9e9e9e", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                >
                                    Reset
                                </button>
                            </>
                        )}

                        {status === "saving" && (
                            <button
                                disabled
                                style={{ padding: "10px 20px", backgroundColor: "#ff9800", color: "white", border: "none", borderRadius: "4px" }}
                            >
                                Saving... {progress.toFixed(1)}%
                            </button>
                        )}

                        {status === "downloading" && (
                            <button
                                disabled
                                style={{ padding: "10px 20px", backgroundColor: "#2196f3", color: "white", border: "none", borderRadius: "4px" }}
                            >
                                Downloading...
                            </button>
                        )}

                        {status === "done" && dbReady && (
                            <>
                                <button
                                    onClick={handleDownload}
                                    style={{ padding: "10px 20px", backgroundColor: "#2196f3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                >
                                    Download File
                                </button>
                                <button
                                    onClick={handleReset}
                                    style={{ padding: "10px 20px", backgroundColor: "#9e9e9e", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                >
                                    Reset
                                </button>
                            </>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={clearDatabase}
                            style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                        >
                            Clear Database (Reset Everything)
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default FileChunkTest;