import { isApple } from "./osUtil";
import streamSaver from "streamsaver";

/**
 * Creates a storage manager for a single file download
 * Fully encapsulated: platform-specific handling and internal state
 * @param {Object} metadata - File metadata
 * @param {string} metadata.name
 * @param {number} metadata.size
 * @param {string} metadata.type
 * @param {Function} log - Optional logging callback
 */
export function createStorageManager(metadata, log = () => {}) {
    const { name, size, type } = metadata;

    const IOS_BUFFER_THRESHOLD = 2 * 1024 * 1024;    // 2 MB
    const NON_IOS_BUFFER_THRESHOLD = 8 * 1024 * 1024; // 8 MB

    const threshold = isApple() ? IOS_BUFFER_THRESHOLD : NON_IOS_BUFFER_THRESHOLD;
    let buffer = new Uint8Array(threshold);
    let offset = 0;
    let iosBlobParts = isApple() ? [] : undefined;
    let writer = null;

    // Initialize non-iOS writer
    if (!isApple()) {
        const fileStream = streamSaver.createWriteStream(name, { size, mimeType: type });
        writer = fileStream.getWriter();
    }

    // -------------------- Internal Methods --------------------
    async function flush() {
        if (isApple()) {
            if (offset === 0) return;
            const blob = new Blob([buffer.slice(0, offset)]);
            iosBlobParts.push(blob);
            offset = 0;
        } else {
            if (!writer || offset === 0) return;
            await writer.write(buffer.slice(0, offset));
            offset = 0;
        }
    }

    async function pushChunk(chunk) {
        if (!chunk) return;
        let remaining = new Uint8Array(chunk);

        while (remaining.length > 0) {
            const spaceLeft = threshold - offset;
            const toWrite = remaining.subarray(0, spaceLeft);
            buffer.set(toWrite, offset);
            offset += toWrite.length;
            remaining = remaining.subarray(toWrite.length);

            if (offset >= threshold) await flush();
        }
    }

    async function finalize() {
        await flush();
        if (isApple()) {
            const finalBlob = new Blob(iosBlobParts, { type });
            buffer = null;
            iosBlobParts = null;
            return finalBlob;
        } else {
            if (writer) await writer.close();
            buffer = null;
            writer = null;
            return null;
        }
    }

    return { pushChunk, finalize };
}
