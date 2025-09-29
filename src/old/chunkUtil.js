/* chunkUtil.js */
import streamSaver from "streamsaver";

const DB_NAME = "SimpleFileTransfer";
const FILES_STORE = "files";
const CHUNKS_STORE = "chunks";

let dbInstance = null;
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

// --------------------- SIMPLE DATABASE --------------------- //

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

            // Simple files store - just file metadata
            if (!db.objectStoreNames.contains(FILES_STORE)) {
                db.createObjectStore(FILES_STORE, { keyPath: "id" });
            }

            // Simple chunks store - just chunk data with file reference
            if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                const store = db.createObjectStore(CHUNKS_STORE, { autoIncrement: true });
                store.createIndex("fileId", "fileId", { unique: false });
            }
        };
    });
};

// --------------------- FILE OPERATIONS --------------------- //

export const createFileRecord = async (fileId, fileName, fileSize) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([FILES_STORE], "readwrite");
        const store = tx.objectStore(FILES_STORE);

        store.put({
            id: fileId,
            name: fileName,
            size: fileSize,
            createdAt: Date.now(),
            chunkCount: 0
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const saveFileChunk = async (fileId, chunkData, chunkIndex) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNKS_STORE], "readwrite");
        const store = tx.objectStore(CHUNKS_STORE);

        // Store chunk with minimal metadata
        store.add({
            fileId: fileId,
            data: chunkData,
            index: chunkIndex
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getFileInfo = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([FILES_STORE], "readonly");
        const store = tx.objectStore(FILES_STORE);
        const req = store.get(fileId);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

export const getChunkCount = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([CHUNKS_STORE], "readonly");
        const store = tx.objectStore(CHUNKS_STORE).index("fileId");
        const req = store.count(IDBKeyRange.only(fileId));

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

export const deleteFile = async (fileId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction([FILES_STORE, CHUNKS_STORE], "readwrite");
        const filesStore = tx.objectStore(FILES_STORE);
        const chunksStore = tx.objectStore(CHUNKS_STORE).index("fileId");

        // Delete file record
        filesStore.delete(fileId);

        // Delete all chunks
        const req = chunksStore.openCursor(IDBKeyRange.only(fileId));
        let deletedChunks = 0;

        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                deletedChunks++;
                cursor.continue();
            }
        };

        tx.oncomplete = () => {
            log(`🗑️ Deleted file ${fileId} with ${deletedChunks} chunks`);
            resolve(deletedChunks);
        };

        tx.onerror = () => reject(tx.error);
    });
};

export const deleteDatabase = async () => {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --------------------- DOWNLOAD OPERATIONS --------------------- //

export const downloadFile = async (fileId, onProgress) => {
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
        throw new Error("File not found");
    }

    const totalChunks = await getChunkCount(fileId);
    log(`Starting download: ${fileInfo.name} (${totalChunks} chunks)`);

    let processedChunks = 0;

    // Create file stream
    const fileStream = streamSaver.createWriteStream(fileInfo.name);
    const writer = fileStream.getWriter();

    try {
        // Get all chunks in order
        const chunks = await new Promise((resolve, reject) => {
            const tx = dbInstance.transaction([CHUNKS_STORE], "readonly");
            const store = tx.objectStore(CHUNKS_STORE).index("fileId");
            const request = store.openCursor(IDBKeyRange.only(fileId));
            const chunkList = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    chunkList.push({
                        key: cursor.primaryKey,
                        data: cursor.value.data,
                        index: cursor.value.index
                    });
                    cursor.continue();
                } else {
                    // Sort by index to ensure correct order
                    chunkList.sort((a, b) => a.index - b.index);
                    resolve(chunkList);
                }
            };

            request.onerror = () => reject(request.error);
        });

        log(`Processing ${chunks.length} chunks...`);

        // Write chunks to file
        for (const chunk of chunks) {
            await writer.write(new Uint8Array(chunk.data));
            processedChunks++;

            // Update progress
            const progress = Math.round((processedChunks / totalChunks) * 100);
            if (onProgress) {
                onProgress(progress);
            }

            // Delete chunk immediately after writing
            await new Promise((resolve, reject) => {
                const tx = dbInstance.transaction([CHUNKS_STORE], "readwrite");
                const store = tx.objectStore(CHUNKS_STORE);
                const req = store.delete(chunk.key);

                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });

            // Small delay to prevent UI blocking
            if (processedChunks % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        // Finalize file
        await writer.close();
        log(`Download completed: ${fileInfo.name}`);

        // Clean up file record
        await deleteFile(fileId);

    } catch (error) {
        // Emergency cleanup
        try {
            await writer.abort();
        } catch (e) {
            // Ignore abort errors
        }
        throw error;
    }
};