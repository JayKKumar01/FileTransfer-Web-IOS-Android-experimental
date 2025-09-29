// chunkUtil.js
const DB_NAME = "JayKKumar01-FileTransferDB";

// Open DB normally
const openDB = (version) =>
    new Promise((resolve, reject) => {
        const request = version
            ? indexedDB.open(DB_NAME, version)
            : indexedDB.open(DB_NAME);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            // store will be created in createStore()
            resolve(event.target.result);
        };
    });

// Create store for a file (call this once per file before saving chunks)
export const createStore = async (id) => {
    const db = await openDB();
    if (db.objectStoreNames.contains(id)) {
        db.close();
        return db; // already exists
    }
    db.close();

    // Need to bump version to add new store
    const newVersion = db.version + 1;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, newVersion);

        request.onupgradeneeded = (event) => {
            const upgradeDB = event.target.result;
            if (!upgradeDB.objectStoreNames.contains(id)) {
                upgradeDB.createObjectStore(id);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Save chunk (assumes store already exists!)
export const save = async (id, index, chunk) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([id], "readwrite");
        const store = tx.objectStore(id);
        const req = store.put(chunk, index);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

// Get all chunks (returns array of values only)
export const getAll = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([id], "readonly");
        const store = tx.objectStore(id);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

// Get all chunks with keys (index + value mapping)
export const getAllWithKeys = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([id], "readonly");
        const store = tx.objectStore(id);
        const req = store.getAllKeys();

        req.onsuccess = async () => {
            const keys = req.result;
            const valuesReq = store.getAll();
            valuesReq.onsuccess = () => {
                const values = valuesReq.result;
                const combined = keys.map((k, i) => ({ index: k, chunk: values[i] }));
                resolve(combined);
            };
            valuesReq.onerror = () => reject(valuesReq.error);
        };
        req.onerror = () => reject(req.error);
    });
};

// Clear a file store
export const clearStore = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([id], "readwrite");
        const store = tx.objectStore(id);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};
