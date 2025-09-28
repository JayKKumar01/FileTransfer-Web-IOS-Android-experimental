/* chunkUtil.js */
import streamSaver from "streamsaver";

const DB_NAME = "JayKKumar01-FileTransferDB";
const META_STORE = "fileMeta";
const CHUNK_STORE = "fileChunks";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let dbInstance = null;
const memoryChunks = {};
const CHUNK_THRESHOLD = isIOS ? 1 * 1024 * 1024 : 8 * 1024 * 1024;

// Global logger reference
let externalLogger = null;

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
                if (cursor.value.data && cursor.value.data.byteLength) {
                    dbSize += cursor.value.data.byteLength;
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
    if (!memoryChunks[fileId]) {
        memoryChunks[fileId] = { chunks: [], size: 0 };
    }

    memoryChunks[fileId].chunks.push(chunk);
    memoryChunks[fileId].size += chunk.byteLength;

    if (memoryChunks[fileId].size >= CHUNK_THRESHOLD) {
        await flush(fileId);
    }
};

export const flush = async (fileId) => {
    if (!memoryChunks[fileId] || memoryChunks[fileId].chunks.length === 0) {
        return;
    }

    const buffer = memoryChunks[fileId];
    const chunks = buffer.chunks;
    const totalSize = buffer.size;

    memoryChunks[fileId] = { chunks: [], size: 0 };

    const combinedBuffer = new Uint8Array(totalSize);
    let offset = 0;

    const yieldInterval = isIOS ? Math.max(1, Math.floor(chunks.length / 20)) : Math.max(1, Math.floor(chunks.length / 10));

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        combinedBuffer.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;

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

// --------------------- CLEANUP UTILITIES --------------------- //

export const clearChunks = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNK_STORE], "readwrite");
        const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
        const request = store.openCursor(IDBKeyRange.only(fileId));

        let deletedCount = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
            } else {
                log(`🧹 Cleared ${deletedCount} chunks for fileId: ${fileId}`);
                resolve(deletedCount);
            }
        };

        request.onerror = () => {
            logError(`❌ Error clearing chunks: ${request.error}`);
            reject(request.error);
        };
    });
};

// --------------------- OPTIMIZED DOWNLOAD METHOD --------------------- //

/**
 * Completely rewritten download method
 * Uses fresh transactions for each operation to prevent cursor hanging
 */
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

    log(`🌍 Platform: ${isIOS ? 'iOS' : 'Non-iOS'}, Total records: ${totalRecords}`);
    if (totalRecords === 0) throw new Error(`No records found for fileId: ${fileId}`);

    let processedRecords = 0;
    let isCancelled = false;

    // Create write stream
    const fileStream = streamSaver.createWriteStream(fileName);
    const writer = fileStream.getWriter();

    try {
        log(`⬇️ Starting download: ${fileName}`);

        // Get all record keys first to avoid cursor issues
        const recordKeys = await new Promise((resolve, reject) => {
            const tx = db.transaction([CHUNK_STORE], "readonly");
            const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
            const request = store.openCursor(IDBKeyRange.only(fileId));
            const keys = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keys.push({
                        key: cursor.primaryKey,
                        size: cursor.value.data ? cursor.value.data.byteLength : 0
                    });
                    cursor.continue();
                } else {
                    resolve(keys);
                }
            };

            request.onerror = () => reject(request.error);
        });

        log(`📋 Found ${recordKeys.length} records to process`);

        // Process records one by one with fresh transactions
        for (let i = 0; i < recordKeys.length; i++) {
            if (isCancelled) break;

            const recordKey = recordKeys[i].key;

            // Get record data in fresh transaction
            const recordData = await new Promise((resolve, reject) => {
                const tx = db.transaction([CHUNK_STORE], "readonly");
                const store = tx.objectStore(CHUNK_STORE);
                const req = store.get(recordKey);

                req.onsuccess = () => {
                    if (req.result && req.result.data) {
                        resolve(req.result.data);
                    } else {
                        reject(new Error(`No data found for key: ${recordKey}`));
                    }
                };
                req.onerror = () => reject(req.error);
            });

            // Write to stream
            await writer.write(new Uint8Array(recordData));

            processedRecords++;

            // Update progress
            if (onProgress) {
                onProgress(processedRecords, totalRecords);
            }

            log(`📦 Processed ${processedRecords}/${totalRecords} (${Math.round((processedRecords / totalRecords) * 100)}%) - ${recordData.byteLength} bytes`);

            // Delete record in fresh transaction
            try {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([CHUNK_STORE], "readwrite");
                    const store = tx.objectStore(CHUNK_STORE);
                    const req = store.delete(recordKey);

                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });

                log(`🗑️ Deleted record: ${recordKey}`);
            } catch (deleteError) {
                logError(`⚠️ Failed to delete record ${recordKey}: ${deleteError.message}`);
                // Continue with download even if deletion fails
            }

            // iOS-specific optimizations
            if (isIOS) {
                // More aggressive memory management for iOS
                if (processedRecords % 2 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

                // Force garbage collection more frequently
                if (processedRecords % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 20));

                    // Clear variables to help GC
                    recordKeys[i] = null;
                }
            } else {
                // Less frequent yields for non-iOS
                if (processedRecords % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }

        // Close the writer
        await writer.close();
        log(`✅ Download completed: ${fileName}`);

        // Final verification and cleanup
        try {
            const remainingChunks = await new Promise((resolve, reject) => {
                const tx = db.transaction([CHUNK_STORE], "readonly");
                const store = tx.objectStore(CHUNK_STORE).index("fileIdIndex");
                const req = store.count(IDBKeyRange.only(fileId));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (remainingChunks > 0) {
                log(`🧹 Found ${remainingChunks} remaining chunks, cleaning up...`);
                await clearChunks(fileId);
            } else {
                log(`🎉 All chunks processed and cleaned successfully`);
            }
        } catch (cleanupError) {
            logError(`⚠️ Final verification failed: ${cleanupError.message}`);
        }

    } catch (error) {
        // Always try to abort the writer on error
        try {
            await writer.abort();
        } catch (abortError) {
            logError(`⚠️ Failed to abort writer: ${abortError.message}`);
        }

        logError(`❌ Download failed: ${error.message}`);
        throw error;
    }
};

// Export only one download method
export { downloadFile as downloadFileManual };