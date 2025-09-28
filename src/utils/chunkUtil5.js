import streamSaver from "streamsaver";

const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let dbInstance = null;
const memoryChunks = {}; // { fileId: { chunks: [], size: 0 } }
const CHUNK_THRESHOLD = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

// --------------------- DATABASE UTILITIES --------------------- //

// Delete DB
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

// Open DB
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
                if (cursor.value.data && cursor.value.data.byteLength) dbSize += cursor.value.data.byteLength;
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

// Create store
export const createStore = async (fileId, fileName) => {
    await setName(fileId, fileName);
    memoryChunks[fileId] = { chunks: [], size: 0 };
};

// Save chunk in memory and flush if threshold reached
export const saveChunk = async (fileId, chunk) => {
    memoryChunks[fileId].chunks.push(chunk);
    memoryChunks[fileId].size += chunk.byteLength;

    if (memoryChunks[fileId].size >= CHUNK_THRESHOLD) await flush(fileId);
};

// Flush chunks to IndexedDB
export const flush = async (fileId) => {
    const buffer = memoryChunks[fileId];
    if (!buffer || buffer.chunks.length === 0) return;

    let chunks = buffer.chunks;
    memoryChunks[fileId] = { chunks: [], size: 0 };

    if (isIOS) {
        // Combine all chunks into one Blob and then convert to ArrayBuffer
        const blob = new Blob(chunks, { type: "application/octet-stream" });
        const arrayBuffer = await blob.arrayBuffer();
        chunks = [arrayBuffer]; // store as single chunk
    }

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


// Set file name
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

// Get file name
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

// --------------------- STREAMING DOWNLOAD --------------------- //

export const downloadFile = async (fileId, onProgress) => {
    await flush(fileId);
    const fileName = await getName(fileId);
    const db = await openDB();

    // Count total chunks
    const totalChunks = await new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const req = store.count(IDBKeyRange.only(fileId));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    let processed = 0;

    // Create a ReadableStream that reads chunks sequentially
    const readableStream = new ReadableStream({
        start(controller) {
            const tx = db.transaction([CHUNK_STORE], "readwrite");
            const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
            const request = store.openCursor(IDBKeyRange.only(fileId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    controller.close();
                    return;
                }

                const chunks = cursor.value.data;
                for (let chunk of chunks) controller.enqueue(new Uint8Array(chunk));

                processed++;
                if (onProgress) onProgress(processed, totalChunks);

                cursor.delete(); // delete chunk after reading
                cursor.continue();
            };

            request.onerror = (err) => controller.error(err);
        },
    });

    await readableStream.pipeTo(streamSaver.createWriteStream(fileName));
};

// Get final Blob progressively, deleting chunks immediately
export const getBlob = async (fileId, type = "application/octet-stream", onProgress) => {
    await flush(fileId);

    const db = await openDB();
    const blobParts = [];
    let processed = 0;

    // Count total chunks first
    const totalChunks = await new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const req = store.count(IDBKeyRange.only(fileId));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readwrite");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const request = store.openCursor(IDBKeyRange.only(fileId));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const chunks = cursor.value.data;
                for (let data of chunks){
                    blobParts.push(new Blob([data], { type }));
                }
                processed++;
                cursor.delete();
                if (onProgress) onProgress(processed, totalChunks);

                cursor.continue();
            } else {
                resolve(new Blob(blobParts, { type }));
            }
        };

        request.onerror = () => reject(request.error);
    });
};

// --------------------- IOS STORAGE REFRESH --------------------- //

export const refreshIOSStorage = () =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => {
            try {
                const db = request.result;
                db.close();
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        request.onerror = () => reject(request.error);
    });
