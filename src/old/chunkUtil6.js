import streamSaver from "streamsaver";

const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let dbInstance = null;
const memoryChunks = {}; // { fileId: { chunks: [], size: 0 } }
const CHUNK_THRESHOLD = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

// Helper for logging
const log = (message, onLog) => {
    if (onLog) onLog(message);
};

// --------------------- DATABASE UTILITIES --------------------- //

export const deleteDatabase = (onLog) =>
    new Promise((resolve, reject) => {
        if (dbInstance) {
            dbInstance.close();
            dbInstance = null;
        }
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = (err) => reject(err);
        deleteRequest.onblocked = () => log("Database deletion blocked.", onLog);
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

    const chunks = buffer.chunks;
    const totalSize = buffer.size;

    memoryChunks[fileId] = { chunks: [], size: 0 };

    const combinedBuffer = new Uint8Array(totalSize);
    let offset = 0;
    const yieldInterval = Math.max(1, Math.floor(chunks.length / 8)); // ~8 yields per flush

    for (let i = 0; i < chunks.length; i++) {
        combinedBuffer.set(new Uint8Array(chunks[i]), offset);
        offset += chunks[i].byteLength;

        if (i % yieldInterval === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    const db = await openDB();
    const tx = db.transaction([CHUNK_STORE], "readwrite");
    const store = tx.objectStore(CHUNK_STORE);

    store.add({ fileId, data: combinedBuffer.buffer });

    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
};

// --------------------- META --------------------- //

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

// --------------------- STREAMING DOWNLOAD --------------------- //

export const downloadFile = async (fileId, onProgress, onLog) => {
    const fileName = await getName(fileId);
    const db = await openDB();

    const totalChunks = await new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const req = store.count(IDBKeyRange.only(fileId));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    if (totalChunks === 0) throw new Error(`No chunks found for fileId: ${fileId}`);
    log(`[Download] Total chunks: ${totalChunks}`, onLog);

    let processedChunks = 0;
    let isCancelled = false;
    let nextChunkPromise = null;

    const fetchChunk = async () => {
        const buffer = await new Promise((resolve, reject) => {
            const tx = db.transaction([CHUNK_STORE], "readwrite");
            const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
            const req = store.openCursor(IDBKeyRange.only(fileId));

            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) return resolve(null);

                const data = cursor.value.data;
                cursor.delete();

                tx.oncomplete = () => {
                    processedChunks++;
                    if (onProgress) onProgress(processedChunks, totalChunks);
                    log(`[Delete] Chunk deleted: key=${cursor.primaryKey} (${processedChunks}/${totalChunks})`, onLog);
                    resolve(data);
                };

                tx.onerror = () => reject(tx.error);
            };

            req.onerror = () => reject(req.error);
        });

        return buffer;
    };

    nextChunkPromise = fetchChunk();

    const readableStream = new ReadableStream({
        async pull(controller) {
            if (isCancelled) {
                controller.close();
                return;
            }

            const chunkData = await nextChunkPromise;
            if (!chunkData) {
                log("[Download] All chunks processed. Closing stream.", onLog);
                controller.close();
                return;
            }

            nextChunkPromise = fetchChunk();
            controller.enqueue(new Uint8Array(chunkData));

            // Yield to main thread
            await new Promise((res) => setTimeout(res, 0));
        },
        cancel() {
            log("[Download] Stream cancelled", onLog);
            isCancelled = true;
        }
    });

    log("[Download] Starting streamSaver pipeTo...", onLog);
    try {
        await readableStream.pipeTo(streamSaver.createWriteStream(fileName));
        log("[Download] File save complete.", onLog);
    } catch (error) {
        log(`[Download] Error during pipeTo: ${error}`, onLog);
        throw error;
    }
};
