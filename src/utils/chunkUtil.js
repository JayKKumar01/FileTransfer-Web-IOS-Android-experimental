/* chunkUtil.js */
import streamSaver from "streamsaver";

const DB_NAME = "FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let dbInstance = null;
let externalLogger = null;

// Set the external logger from FileSender
export const setChunkUtilLogger = (logger) => {
    externalLogger = logger;
};

const log = (message) => {
    if (externalLogger) {
        externalLogger(message);
    } else {
        console.log(message);
    }
};

const logError = (message) => {
    if (externalLogger) {
        externalLogger(`❌ ${message}`);
    } else {
        console.error(message);
    }
};

// --------------------- DATABASE SETUP --------------------- //
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
const openDB = () => {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

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
        };
    });
};

// --------------------- FILE MANAGEMENT --------------------- //

export const createStore = async (fileId, fileName) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([META_STORE], "readwrite");
        const store = tx.objectStore(META_STORE);
        store.put({ fileId, fileName, createdAt: Date.now() });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const saveChunk = async (fileId, chunk, chunkIndex) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readwrite");
        const store = tx.objectStore(CHUNK_STORE);

        // Store each chunk individually with its index for proper ordering
        store.add({
            fileId,
            data: chunk,
            chunkIndex,
            timestamp: Date.now()
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getStoredChunksCount = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readonly");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const req = store.count(IDBKeyRange.only(fileId));

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

export const getFileName = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([META_STORE], "readonly");
        const store = tx.objectStore(META_STORE);
        const req = store.get(fileId);

        req.onsuccess = () => resolve(req.result?.fileName || "download.bin");
        req.onerror = () => reject(req.error);
    });
};

export const clearFileData = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE, META_STORE], "readwrite");
        const chunkStore = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const metaStore = tx.objectStore(META_STORE);

        // Delete all chunks
        const chunkReq = chunkStore.openCursor(IDBKeyRange.only(fileId));
        let chunksDeleted = 0;

        chunkReq.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                chunksDeleted++;
                cursor.continue();
            }
        };

        // Delete metadata
        metaStore.delete(fileId);

        tx.oncomplete = () => {
            log(`🧹 Cleared ${chunksDeleted} chunks for file ${fileId}`);
            resolve(chunksDeleted);
        };

        tx.onerror = () => reject(tx.error);
    });
};

// --------------------- DOWNLOAD LOGIC --------------------- //

export const downloadFile = async (fileId, onProgress) => {
    const fileName = await getFileName(fileId);
    const db = await openDB();

    // Get total chunks count
    const totalChunks = await getStoredChunksCount(fileId);
    log(`📊 Starting download: ${fileName} (${totalChunks} chunks)`);

    if (totalChunks === 0) {
        throw new Error("No chunks found for this file");
    }

    let processedChunks = 0;

    // Create the file stream
    const fileStream = streamSaver.createWriteStream(fileName);
    const writer = fileStream.getWriter();

    try {
        // Get all chunk keys in order
        const chunkKeys = await new Promise((resolve, reject) => {
            const tx = db.transaction([CHUNK_STORE], "readonly");
            const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
            const request = store.openCursor(IDBKeyRange.only(fileId));
            const keys = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keys.push({
                        key: cursor.primaryKey,
                        chunkIndex: cursor.value.chunkIndex,
                        size: cursor.value.data.byteLength
                    });
                    cursor.continue();
                } else {
                    // Sort by chunkIndex to ensure correct order
                    keys.sort((a, b) => a.chunkIndex - b.chunkIndex);
                    resolve(keys);
                }
            };

            request.onerror = () => reject(request.error);
        });

        log(`🔢 Processing ${chunkKeys.length} chunks in order`);

        // Process chunks sequentially
        for (const chunkInfo of chunkKeys) {
            // Read chunk data
            const chunkData = await new Promise((resolve, reject) => {
                const tx = db.transaction([CHUNK_STORE], "readonly");
                const store = tx.objectStore(CHUNK_STORE);
                const req = store.get(chunkInfo.key);

                req.onsuccess = () => {
                    if (req.result && req.result.data) {
                        resolve(req.result.data);
                    } else {
                        reject(new Error(`Missing data for chunk ${chunkInfo.chunkIndex}`));
                    }
                };
                req.onerror = () => reject(req.error);
            });

            // Write to file stream
            await writer.write(new Uint8Array(chunkData));

            processedChunks++;

            // Update progress
            const progress = Math.round((processedChunks / totalChunks) * 100);
            if (onProgress) {
                onProgress(progress, processedChunks, totalChunks);
            }

            log(`📦 Written chunk ${processedChunks}/${totalChunks} (${progress}%) - ${chunkData.byteLength} bytes`);

            // Delete chunk immediately after writing
            await new Promise((resolve, reject) => {
                const tx = db.transaction([CHUNK_STORE], "readwrite");
                const store = tx.objectStore(CHUNK_STORE);
                const req = store.delete(chunkInfo.key);

                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });

            // iOS Memory Management
            if (isIOS) {
                // Force garbage collection breaks
                if (processedChunks % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

                // More aggressive cleanup near completion
                if (processedChunks > totalChunks * 0.8) {
                    await new Promise(resolve => setTimeout(resolve, 15));
                }
            }
        }

        // Finalize the file
        await writer.close();
        log(`✅ Download completed: ${fileName}`);

        // Clean up metadata
        await clearFileData(fileId);

        return fileName;

    } catch (error) {
        // Emergency cleanup on error
        try {
            await writer.abort();
        } catch (abortError) {
            logError(`⚠️ Writer abort failed: ${abortError.message}`);
        }

        logError(`❌ Download failed: ${error.message}`);
        throw error;
    }
};

// Export for backward compatibility
export { downloadFile as downloadFileManual };