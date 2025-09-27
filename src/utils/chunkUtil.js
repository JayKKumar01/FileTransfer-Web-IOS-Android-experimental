const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Singleton DB instance
let dbInstance = null;

// Delete the entire database (call at page start to reset schema)
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

// Open DB (single-version schema, auto-create stores if missing)
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

            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: "fileId" });
            }

            if (!db.objectStoreNames.contains(CHUNK_STORE)) {
                const store = db.createObjectStore(CHUNK_STORE, { autoIncrement: true });
                store.createIndex("fileIdIndex", "fileId", { unique: false });
            }

            dbInstance = db;
        };
    });

// Create store (save metadata)
export const createStore = async (fileId, fileName) => {
    await setName(fileId, fileName);
};

// Save chunk (iOS: ArrayBuffer, others: Blob)
export const saveChunk = async (fileId, chunk) => {
    const db = await openDB();
    const dataToStore = isIOS ? await chunk.arrayBuffer() : chunk;

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readwrite");
        const store = tx.objectStore(CHUNK_STORE);
        const req = store.add({ fileId, data: dataToStore });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

// Save file name in meta store
export const setName = async (fileId, name) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([META_STORE], "readwrite");
        const store = tx.objectStore(META_STORE);
        const req = store.put({ fileId, name });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
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
    const db = await openDB();

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

// Clear all chunks for a file
export const clearChunks = async (fileId) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readwrite");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");

        const request = store.openCursor(IDBKeyRange.only(fileId));
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
};
