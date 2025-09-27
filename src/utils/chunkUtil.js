const DB_NAME = "JayKKumar01-FileTransferDB-002";
const META_STORE = "fileMeta";

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Open DB
const openDB = (version) =>
    new Promise((resolve, reject) => {
        const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: "fileId" });
            }
            resolve(db);
        };
    });

// Create store for a file (chunks)
export const createStore = async (fileId, fileName) => {
    const db = await openDB();
    if (!db.objectStoreNames.contains(fileId)) {
        db.close();
        const newVersion = db.version + 1;
        await new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, newVersion);
            request.onupgradeneeded = (event) => {
                const upgradeDB = event.target.result;
                if (!upgradeDB.objectStoreNames.contains(fileId)) {
                    upgradeDB.createObjectStore(fileId, { autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Save file name in meta store
    await setName(fileId, fileName);
};

// Save chunk (iOS: ArrayBuffer, others: Blob)
export const saveChunk = async (fileId, chunk) => {
    const db = await openDB();
    let dataToStore = chunk;

    if (isIOS) {
        // Convert Blob to ArrayBuffer for iOS
        dataToStore = await chunk.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction([fileId], "readwrite");
        const store = tx.objectStore(fileId);
        const req = store.add(dataToStore);
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

// Get final Blob safely with progress
export const getBlob = async (fileId, type = "application/octet-stream", onProgress) => {
    const db = await openDB();

    const totalChunks = await new Promise((resolve, reject) => {
        const tx = db.transaction([fileId], "readonly");
        const store = tx.objectStore(fileId);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    return new Promise((resolve, reject) => {
        const tx = db.transaction([fileId], "readonly");
        const store = tx.objectStore(fileId);
        const request = store.openCursor();
        const blobParts = [];
        let processed = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (isIOS) {
                    blobParts.push(new Blob([cursor.value], { type }));
                } else {
                    // Non-iOS: cursor.value is already Blob
                    blobParts.push(cursor.value);
                }

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
        const tx = db.transaction([fileId], "readwrite");
        const store = tx.objectStore(fileId);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};
