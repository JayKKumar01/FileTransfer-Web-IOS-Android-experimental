// fileReceiverUtil.js

// Store buffers and blob parts per file
const bufferMap = {};
const bufferOffsetMap = {};
const blobPartsMap = {};

// Platform-specific buffer threshold
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const BUFFER_THRESHOLD = isIOS ? 2 * 1024 * 1024 : 8 * 1024 * 1024; // 2MB / 8MB

/**
 * Initialize buffer for a file
 */
export function initBufferRefs(fileId) {
    if (!bufferMap[fileId]) bufferMap[fileId] = new Uint8Array(BUFFER_THRESHOLD);
    if (!bufferOffsetMap[fileId]) bufferOffsetMap[fileId] = 0;
    if (!blobPartsMap[fileId]) blobPartsMap[fileId] = [];
}

/**
 * Push a chunk into buffer and flush if threshold is reached
 */
export async function pushChunk(fileId, chunk) {
    initBufferRefs(fileId);

    const offset = bufferOffsetMap[fileId];
    bufferMap[fileId].set(new Uint8Array(chunk), offset);
    bufferOffsetMap[fileId] += chunk.byteLength;

    if (bufferOffsetMap[fileId] >= BUFFER_THRESHOLD) {
        await flushBuffer(fileId);
    }
}

/**
 * Flush buffer into blob parts
 */
export async function flushBuffer(fileId) {
    const offset = bufferOffsetMap[fileId];
    if (!offset) return;

    const blob = new Blob([bufferMap[fileId].slice(0, offset)]);
    blobPartsMap[fileId].push(blob);

    bufferOffsetMap[fileId] = 0;
}

/**
 * Finalize file into a Blob
 */
export async function finalizeFile(fileId, fileName, mimeType = "application/octet-stream") {
    await flushBuffer(fileId);

    const blob = new Blob(blobPartsMap[fileId], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);

    // cleanup
    delete bufferMap[fileId];
    delete bufferOffsetMap[fileId];
    delete blobPartsMap[fileId];
}
