/* chunkUtil.js */
import streamSaver from "streamsaver";

const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let dbInstance = null;
const memoryChunks = {}; // { fileId: { chunks: [], size: 0 } }
const CHUNK_THRESHOLD = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

// --------------------- DATABASE UTILITIES --------------------- //

export const deleteDatabase = () =>
    new Promise((resolve, reject) => {
        if (dbInstance) {
            dbInstance.close();
            dbInstance = null;
        }
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = (err) => reject(err);
        deleteRequest.onblocked = () => console.warn("Database deletion blocked.");
    });

const openDB = () =>
    new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);

        const request = indexedDB.open(DB_NAME);
        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(META_STORE))
                db.createObjectStore(META_STORE, { keyPath: "fileId" });
            if (!db.objectStoreNames.contains(CHUNK_STORE)) {
                const store = db.createObjectStore(CHUNK_STORE, { autoIncrement: true });
                store.createIndex("fileIdIndex", "fileId", { unique: false });
            }
            dbInstance = db;
        };
    });

// Get file info
export const getInfo = async (fileId) => {
    const memoryInfo = memoryChunks[fileId]
        ? { count: memoryChunks[fileId].chunks.length, size: memoryChunks[fileId].size }
        : { count: 0, size: 0 };

    const db = await openDB();
    let dbCount = 0;
    let dbSize = 0;

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const index = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const request = index.openCursor(IDBKeyRange.only(fileId));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                dbCount++;
                // cursor.value.data is array of ArrayBuffers: sum sizes
                if (Array.isArray(cursor.value.data)) {
                    for (const ab of cursor.value.data) {
                        if (ab && ab.byteLength) dbSize += ab.byteLength;
                    }
                }
                cursor.continue();
            } else {
                resolve({
                    fileId,
                    memoryChunks: memoryInfo,
                    databaseChunks: { count: dbCount, size: dbSize },
                    total: { count: memoryInfo.count + dbCount, size: memoryInfo.size + dbSize },
                });
            }
        };

        request.onerror = () => reject(request.error);
    });
};

// --------------------- CHUNK MANAGEMENT --------------------- //

export const createStore = async (fileId, fileName) => {
    await setName(fileId, fileName);
    memoryChunks[fileId] = { chunks: [], size: 0 };
};

export const saveChunk = async (fileId, chunk) => {
    memoryChunks[fileId].chunks.push(chunk);
    memoryChunks[fileId].size += chunk.byteLength;

    if (memoryChunks[fileId].size >= CHUNK_THRESHOLD) await flush(fileId);
};

export const flush = async (fileId) => {
    const buffer = memoryChunks[fileId];
    if (!buffer || buffer.chunks.length === 0) return;

    let chunks = buffer.chunks;
    memoryChunks[fileId] = { chunks: [], size: 0 };

    // If you want special ios behaviour (pack chunks into fewer records), handle here
    // For simplicity we store the array of ArrayBuffers as-is:
    const db = await openDB();
    const tx = db.transaction([CHUNK_STORE], "readwrite");
    const store = tx.objectStore(CHUNK_STORE);
    store.add({ fileId, data: chunks });

    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
};

// Set / get name
export const setName = async (fileId, name) => {
    const db = await openDB();
    const tx = db.transaction([META_STORE], "readwrite");
    const store = tx.objectStore(META_STORE);
    store.put({ fileId, name });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
};

export const getName = async (fileId) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([META_STORE], "readonly");
        const store = tx.objectStore(META_STORE);
        const req = store.get(fileId);
        req.onsuccess = () => resolve(req.result?.name || "unknown_file");
        req.onerror = () => reject(req.error);
    });
};

// --------------------- STREAMING DOWNLOAD (robust) --------------------- //

export const downloadFile = async (fileId, onProgress) => {
    const fileName = await getName(fileId);
    const db = await openDB();

    // Count total records for progress
    const totalRecords = await new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const req = store.count(IDBKeyRange.only(fileId));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    console.log("[Download] Total records:", totalRecords);

    let processedRecords = 0;
    let currentChunks = [];
    let currentChunkPtr = 0;
    let cursorKey = null;

    const readableStream = new ReadableStream({
        async pull(controller) {
            // Load next record if all chunks of current record are done
            if (currentChunkPtr >= currentChunks.length) {
                if (cursorKey !== null) {
                    // Delete last processed record in a short transaction
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction([CHUNK_STORE], "readwrite");
                        const store = tx.objectStore(CHUNK_STORE);
                        const req = store.delete(cursorKey);
                        req.onsuccess = () => {
                            processedRecords++; // increment AFTER deletion
                            if (onProgress) onProgress(processedRecords, totalRecords);
                            console.log(`[Delete] Record deleted: key=${cursorKey} (${processedRecords}/${totalRecords})`);
                            resolve();
                        };
                        req.onerror = () => reject(req.error);
                    });
                }

                // Open a fresh transaction to load next record
                const nextRecord = await new Promise((resolve, reject) => {
                    const tx = db.transaction([CHUNK_STORE], "readonly");
                    const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
                    const range = cursorKey ? IDBKeyRange.lowerBound(cursorKey, true) : IDBKeyRange.only(fileId);
                    const req = store.openCursor(range);
                    req.onsuccess = (e) => resolve(e.target.result);
                    req.onerror = (e) => reject(e.target.error);
                });

                if (!nextRecord) {
                    console.log("[Download] All records processed. Closing stream.");
                    controller.close();
                    return;
                }

                // Setup for streaming chunks from this record
                cursorKey = nextRecord.primaryKey;
                currentChunks = nextRecord.value.data;
                currentChunkPtr = 0;

                console.log(`[Record] Loaded record chunks=${currentChunks.length}, cursorKey=${cursorKey}`);
            }

            // Enqueue next chunk
            const buf = currentChunks[currentChunkPtr++];
            controller.enqueue(new Uint8Array(buf));
            currentChunks[currentChunkPtr - 1] = null; // free memory

            console.log(`[Enqueue] chunkIdx=${currentChunkPtr} size=${buf.byteLength}`);
        },
    });

    console.log("[Download] Starting streamSaver pipeTo...");
    await readableStream.pipeTo(streamSaver.createWriteStream(fileName));
    console.log("[Download] File save complete.");
};

