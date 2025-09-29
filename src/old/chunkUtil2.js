const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let dbInstance = null;
const memoryChunks = {}; // { fileId: { chunks: [], size: 0 } }
const CHUNK_SIZE = 256 * 1024;
const CHUNK_THRESHOLD = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

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

// Get database info for a specific file
export const getInfo = async (fileId) => {
    try {
        // Memory chunks info
        const memoryInfo = memoryChunks[fileId] ? {
            count: memoryChunks[fileId].chunks.length,
            size: memoryChunks[fileId].size
        } : { count: 0, size: 0 };

        // Database chunks info
        let dbCount = 0;
        let dbSize = 0;

        const db = await openDB();
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const index = tx.objectStore(CHUNK_STORE).index("fileIdIndex");

        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(fileId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    dbCount++;
                    if (cursor.value.data && cursor.value.data.byteLength) {
                        dbSize += cursor.value.data.byteLength;
                    }
                    cursor.continue();
                } else {
                    resolve({
                        fileId,
                        memoryChunks: memoryInfo,
                        databaseChunks: {
                            count: dbCount,
                            size: dbSize
                        },
                        total: {
                            count: memoryInfo.count + dbCount,
                            size: memoryInfo.size + dbSize
                        }
                    });
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting file info:', error);
        throw error;
    }
};

// Create store
export const createStore = async (fileId, fileName) => {
    await setName(fileId, fileName);
    memoryChunks[fileId] = { chunks: [], size: 0 };
};

// Save chunk
export const saveChunk = async (fileId, chunk) => {
    memoryChunks[fileId].chunks.push(chunk);
    memoryChunks[fileId].size += chunk.size;

    if (memoryChunks[fileId].size >= CHUNK_THRESHOLD) {
        await flush(fileId);
        // await flushTest(fileId);
    }
};

export const flushTest = async (fileId) => {
    const buffer = memoryChunks[fileId];
    if (!buffer || buffer.chunks.length === 0) return;

    // Release memory chunks immediately
    const chunks = buffer.chunks;
    memoryChunks[fileId] = {chunks: [], size: 0};

    const combinedBlob = new Blob(chunks);
    const dataToStore = await combinedBlob.arrayBuffer();
    console.log('dataToStore', dataToStore.byteLength);
}

// Flush chunks to DB
export const flush = async (fileId) => {
    const buffer = memoryChunks[fileId];
    if (!buffer || buffer.chunks.length === 0) return;

    // Release memory chunks immediately
    const chunks = buffer.chunks;
    memoryChunks[fileId] = { chunks: [], size: 0 };

    const combinedBlob = new Blob(chunks);
    const dataToStore = await combinedBlob.arrayBuffer();

    const db = await openDB();
    const tx = db.transaction([CHUNK_STORE], "readwrite");
    const store = tx.objectStore(CHUNK_STORE);

    store.add({ fileId, data: dataToStore });

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
                const data = cursor.value.data;
                blobParts.push(new Blob([data], { type }));
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

export const refreshIOSStorage = () =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);

        request.onsuccess = () => {
            try {
                const db = request.result;
                db.close(); // close immediately
                resolve(true); // success feedback
            } catch (err) {
                reject(err);
            }
        };

        request.onerror = () => reject(request.error);
    });
