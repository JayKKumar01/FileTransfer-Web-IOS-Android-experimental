import React, { useState, useRef } from "react";

export default function FileChunkTransfer() {
    const CHUNK_SIZE = 256 * 1024; // 256 KB
    const [fileName, setFileName] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const fileRef = useRef(null);

    // Inline styling respecting parent flex
    const rootStyle = {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        flex: 1,
        gap: 8,
        padding: 8,
        boxSizing: "border-box",
    };
    const row = { display: "flex", gap: 8, alignItems: "center" };
    const btn = { padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" };
    const progressBar = { height: 10, background: "#eee", borderRadius: 6, overflow: "hidden" };
    const progressFill = (p) => ({ width: `${p}%`, height: "100%", background: "linear-gradient(90deg,#4caf50,#81c784)" });

    async function readSlice(file, start, end) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const blob = file.slice(start, end);
            reader.onerror = () => {
                reader.abort();
                reject(new Error("File read error"));
            };
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(blob);
        });
    }

    function openIdb(dbName = "file-chunks-db", storeName = "chunks") {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "index" });
            };
            req.onsuccess = () => resolve({ db: req.result, storeName });
            req.onerror = () => reject(req.error);
        });
    }

    async function idbPutMany(chunks) {
        const { db, storeName } = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            for (const item of chunks) store.put(item);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbIterateAndBuild() {
        const { db, storeName } = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const req = store.openCursor();
            const parts = [];
            req.onsuccess = (e) => {
                const cur = e.target.result;
                if (!cur) {
                    resolve(parts);
                    return;
                }
                parts.push(cur.value.blob);
                cur.continue();
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function idbClear() {
        const { db, storeName } = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function simulateTransferAndReconstruct(file) {
        setStatus("preparing receiver...");
        const supportsFileSystemAccess = !!window.showSaveFilePicker;
        let writable;
        if (supportsFileSystemAccess) {
            try {
                const fileHandle = await window.showSaveFilePicker({ suggestedName: file.name });
                writable = await fileHandle.createWritable();
                setStatus("writing via File System Access API (streaming to disk)...");
            } catch (err) {
                console.warn("showSaveFilePicker aborted or failed", err);
            }
        }

        await idbClear();
        const total = file.size;
        let offset = 0;
        let index = 0;
        const chunkMetaToStore = [];
        setProgress(0);
        setStatus("reading & sending chunks...");

        while (offset < total) {
            const end = Math.min(offset + CHUNK_SIZE, total);
            const ab = await readSlice(file, offset, end);
            const chunkBlob = new Blob([ab]);

            if (writable) {
                await writable.write(chunkBlob);
            } else {
                chunkMetaToStore.push({ index, blob: chunkBlob });
                if (chunkMetaToStore.length >= 128) {
                    await idbPutMany(chunkMetaToStore);
                    chunkMetaToStore.length = 0;
                }
            }

            index += 1;
            offset = end;
            setProgress(Math.round((offset / total) * 100));
            await new Promise((r) => setTimeout(r, 0));
        }

        if (!writable && chunkMetaToStore.length) await idbPutMany(chunkMetaToStore);

        if (writable) {
            await writable.close();
            setStatus(`saved to disk via File System Access as: ${file.name}`);
            setProgress(100);
            return;
        }

        setStatus("reconstructing file from IndexedDB (may be heavy)...");
        const parts = await idbIterateAndBuild();

        setStatus("creating final Blob for download...");
        try {
            const finalBlob = new Blob(parts);
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setStatus("download triggered (blob)");
            setProgress(100);
        } catch (err) {
            setStatus("failed to create final Blob — likely memory limit on this browser.");
            console.error(err);
        }
    }

    async function handleFileSelect(e) {
        const f = e.target.files[0];
        if (!f) return;
        setFileName(f.name);
        setProgress(0);
        setStatus("starting transfer...");
        try {
            await simulateTransferAndReconstruct(f);
        } catch (err) {
            console.error(err);
            setStatus("error: " + (err && err.message ? err.message : String(err)));
        }
    }

    return (
        <div style={rootStyle}>
            <div style={row}>
                <input ref={fileRef} type="file" onChange={handleFileSelect} style={{ flex: 1 }} />
                <button
                    style={btn}
                    onClick={() => {
                        if (fileRef.current) fileRef.current.value = null;
                        setFileName(null);
                        setProgress(0);
                        setStatus("idle");
                    }}
                >
                    Reset
                </button>
            </div>

            <div style={{ ...row, justifyContent: "space-between" }}>
                <div style={{ fontSize: 13 }}>{fileName || "No file chosen"}</div>
                <div style={{ fontSize: 13 }}>{progress}%</div>
            </div>

            <div style={progressBar} aria-hidden>
                <div style={progressFill(progress)} />
            </div>

            <div style={{ fontSize: 13, color: "#444" }}>{status}</div>

            <div style={{ fontSize: 12, color: "#777" }}>
                Notes: reads 256KB slices only. If your browser supports the File System Access API this will stream directly to disk.
                On browsers without that API, the component stores chunks in IndexedDB and assembles a final Blob for download — may fail for huge files on memory-constrained browsers.
            </div>
        </div>
    );
}
