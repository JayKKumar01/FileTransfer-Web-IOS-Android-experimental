import React, { useState } from "react";

const CHUNK_SIZE = 250 * 1024; // 250 KB

const FileChunkTest = () => {
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("idle"); // idle | saving | done
    const [dbReady, setDbReady] = useState(false);

    // IndexedDB setup
    const openDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("TestFileDB", 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("chunks")) {
                    db.createObjectStore("chunks", { keyPath: "id" });
                }
            };
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    };

    const storeChunk = async (fileId, chunkIndex, chunkData) => {
        const db = await openDB();
        const tx = db.transaction("chunks", "readwrite");
        const store = tx.objectStore("chunks");
        store.put({ id: `${fileId}-${chunkIndex}`, fileId, chunkIndex, data: chunkData });
        return new Promise((res, rej) => {
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    };

    const getChunks = async (fileId) => {
        const db = await openDB();
        const tx = db.transaction("chunks", "readonly");
        const store = tx.objectStore("chunks");
        const chunks = [];
        const request = store.openCursor();
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.fileId === fileId) chunks.push({ index: cursor.value.chunkIndex, data: cursor.value.data });
                    cursor.continue();
                } else {
                    chunks.sort((a, b) => a.index - b.index);
                    resolve(chunks.map(c => c.data));
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });
    };

    const deleteChunks = async (fileId) => {
        const db = await openDB();
        const tx = db.transaction("chunks", "readwrite");
        const store = tx.objectStore("chunks");
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.fileId === fileId) store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setProgress(0);
            setStatus("idle");
        }
    };

    const handleSaveToIndexedDB = async () => {
        if (!file) return;
        setStatus("saving");
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const blob = file.slice(start, end);
            await storeChunk(file.name, i, blob);
            setProgress(((i + 1) / totalChunks) * 100);
        }

        setStatus("done");
        setDbReady(true);
    };

    const handleDownload = async () => {
        if (!file) return;
        const chunks = await getChunks(file.name);
        const blob = new Blob(chunks, { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        await deleteChunks(file.name);
        setDbReady(false);
        setStatus("idle");
        setFile(null);
        setProgress(0);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", padding: "10px" }}>
            <input type="file" onChange={handleFileChange} />
            {file && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                        <strong>{file.name}</strong> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                    <div style={{ width: "100%", background: "#eee", height: "15px", borderRadius: "5px", overflow: "hidden" }}>
                        <div style={{ width: `${progress.toFixed(2)}%`, height: "100%", background: "#4caf50" }} />
                    </div>
                    <div>
                        {status === "saving" && <span>Saving to IndexedDB... {progress.toFixed(2)}%</span>}
                        {status === "done" && dbReady && <button onClick={handleDownload}>Download File</button>}
                    </div>
                    {status === "idle" && <button onClick={handleSaveToIndexedDB}>Save to IndexedDB</button>}
                </div>
            )}
        </div>
    );
};

export default FileChunkTest;
