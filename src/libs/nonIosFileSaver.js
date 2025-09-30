// nonIosFileSaver.js
// Minimal non-iOS streaming file saver library

const writerMap = {}; // fileId -> WritableStreamDefaultWriter

/**
 * Initialize a writable stream for a file
 * @param {string} fileId
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {WritableStreamDefaultWriter}
 */
export function createWriteStream(fileId, fileName, mimeType = "application/octet-stream") {
    if (writerMap[fileId]) return writerMap[fileId];

    // Create a TransformStream to handle chunks
    const ts = new TransformStream();

    // Create a MessageChannel to send the readable stream for download
    const channel = new MessageChannel();

    // Post readable stream to a temporary iframe for download
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    // Transfer readable stream to iframe for download
    channel.port1.postMessage({
        readableStream: ts.readable,
        filename: fileName,
        mimeType,
    }, [ts.readable]);

    // Create the writer
    const writer = ts.writable.getWriter();
    writerMap[fileId] = writer;
    return writer;
}

/**
 * Write a chunk to the file
 * @param {string} fileId
 * @param {ArrayBuffer|Uint8Array} chunk
 */
export async function writeChunk(fileId, chunk) {
    const writer = writerMap[fileId];
    if (!writer) throw new Error(`Writer not found for fileId: ${fileId}`);
    await writer.write(chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk);
}

/**
 * Finalize the file
 * @param {string} fileId
 */
export async function finalizeFile(fileId) {
    const writer = writerMap[fileId];
    if (!writer) return;
    await writer.close();
    delete writerMap[fileId];
}
