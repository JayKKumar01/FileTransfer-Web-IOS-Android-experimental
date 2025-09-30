import streamSaver from "streamsaver";

// -------------------- Platform Detection --------------------
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

// -------------------- iOS Buffers --------------------
const BUFFER_THRESHOLD = 2 * 1024 * 1024; // 2 MB
const bufferMap = {};
const bufferOffsetMap = {};
const blobPartsMap = {};

// -------------------- Non-iOS Writers --------------------
const writerMap = {};

// -------------------- iOS Helpers --------------------
async function iosInit(fileId) {
    if (!bufferMap[fileId]) bufferMap[fileId] = new Uint8Array(BUFFER_THRESHOLD);
    if (!bufferOffsetMap[fileId]) bufferOffsetMap[fileId] = 0;
    if (!blobPartsMap[fileId]) blobPartsMap[fileId] = [];
}

async function iosPushChunk(fileId, chunk) {
    if (!chunk) return;
    let remaining = new Uint8Array(chunk);

    while (remaining.length > 0) {
        const offset = bufferOffsetMap[fileId];
        const spaceLeft = BUFFER_THRESHOLD - offset;

        const toWrite = remaining.subarray(0, spaceLeft);
        bufferMap[fileId].set(toWrite, offset);
        bufferOffsetMap[fileId] += toWrite.length;

        remaining = remaining.subarray(toWrite.length);

        if (bufferOffsetMap[fileId] >= BUFFER_THRESHOLD) {
            await iosFlush(fileId);
        }

        if (remaining.length > 0) {
            console.log(
                "Chunk too large for iOS buffer, splitting:",
                toWrite.length + remaining.length,
                ">", BUFFER_THRESHOLD
            );
        }
    }
}

async function iosFlush(fileId) {
    const offset = bufferOffsetMap[fileId];
    if (!offset) return;

    const blob = new Blob([bufferMap[fileId].slice(0, offset)]);
    blobPartsMap[fileId].push(blob);
    bufferOffsetMap[fileId] = 0;
}

async function iosFinalize(fileId, fileName, mimeType = "application/octet-stream") {
    await iosFlush(fileId);

    const blob = new Blob(blobPartsMap[fileId], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);

    delete bufferMap[fileId];
    delete bufferOffsetMap[fileId];
    delete blobPartsMap[fileId];
}

// -------------------- Non-iOS Helpers --------------------
function nonIosInit(fileId, fileName, mimeType = "application/octet-stream") {
    if (!writerMap[fileId]) {
        const fileStream = streamSaver.createWriteStream(fileName, { size: 0, mimeType });
        writerMap[fileId] = fileStream.getWriter();
    }
}

async function nonIosPushChunk(fileId, chunk) {
    const writer = writerMap[fileId];
    if (writer && chunk) await writer.write(new Uint8Array(chunk));
}

async function nonIosFinalize(fileId) {
    const writer = writerMap[fileId];
    if (writer) {
        await writer.close();
        delete writerMap[fileId];
    }
}

// -------------------- Public API --------------------
export function initFile(fileId, fileName, mimeType = "application/octet-stream") {
    return isIOS ? iosInit(fileId) : nonIosInit(fileId, fileName, mimeType);
}

export function pushChunk(fileId, chunk) {
    return isIOS ? iosPushChunk(fileId, chunk) : nonIosPushChunk(fileId, chunk);
}

export function flushBuffer(fileId) {
    return isIOS ? iosFlush(fileId) : Promise.resolve();
}

export function finalizeFile(fileId, fileName, mimeType = "application/octet-stream") {
    return isIOS ? iosFinalize(fileId, fileName, mimeType) : nonIosFinalize(fileId);
}
