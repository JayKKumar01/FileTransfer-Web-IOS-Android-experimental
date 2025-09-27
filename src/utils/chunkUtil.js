const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Singleton DB instance
let dbInstance = null;

// In-memory buffer for batching chunks
const memoryChunks = {}; // { fileId: { chunks: [], size: 0 } }
const CHUNK_THRESHOLD = 2 * 1024 * 1024; // 2MB

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

// Create store (metadata + memory buffer)
export const createStore = async (fileId, fileName) => {
    await setName(fileId, fileName);
    memoryChunks[fileId] = { chunks: [], size: 0 }; // init memory buffer
};

// Save chunk (in-memory batching)
export const saveChunk = async (fileId, chunk) => {
    memoryChunks[fileId].chunks.push(chunk);
    memoryChunks[fileId].size += chunk.size;

    if (memoryChunks[fileId].size >= CHUNK_THRESHOLD) {
        await flush(fileId);
    }
};

// Flush memory chunks to IndexedDB (iOS-safe)
export const flush = async (fileId) => {
    const buffer = memoryChunks[fileId];
    if (!buffer || buffer.chunks.length === 0) return;

    // Prepare data before transaction
    const combinedBlob = new Blob(buffer.chunks);
    const dataToStore = isIOS ? await combinedBlob.arrayBuffer() : combinedBlob;

    const db = await openDB();
    const tx = db.transaction([CHUNK_STORE], "readwrite");
    const store = tx.objectStore(CHUNK_STORE);

    store.add({ fileId, data: dataToStore });

    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

    memoryChunks[fileId] = { chunks: [], size: 0 };
};

// Set file name in meta
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

// Get final Blob with progress
export const getBlob = async (fileId, type = "application/octet-stream", onProgress) => {
    await flush(fileId); // flush remaining memory chunks

    const db = await openDB();

    // Count total chunks
    const totalChunks = await new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const req = store.count(IDBKeyRange.only(fileId));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const request = store.openCursor(IDBKeyRange.only(fileId));
        const blobParts = [];
        let processed = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                blobParts.push(isIOS ? new Blob([cursor.value.data], { type }) : cursor.value.data);
                processed++;
                if (onProgress) onProgress(processed, totalChunks);
                cursor.continue();
            } else {
                resolve(new Blob(blobParts, { type }));
            }
        };

        request.onerror = () => reject(request.error);
    });
};

// Clear all chunks (iOS-safe)
export const clearChunks = async (fileId) => {
    memoryChunks[fileId] = { chunks: [], size: 0 };

    const db = await openDB();
    const tx = db.transaction([CHUNK_STORE], "readwrite");
    const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");

    const request = store.openCursor(IDBKeyRange.only(fileId));
    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };

    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
};
