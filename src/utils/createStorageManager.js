import {isApple} from "./osUtil";

/**
 * Creates a storage manager for a single file download
 * Fully encapsulated: platform-specific handling and internal state
 * @param {Object} metadata - File metadata
 * @param {string} metadata.name - File name
 * @param {number} metadata.size - File size in bytes
 * @param {string} metadata.type - MIME type
 */
export function createStorageManager(metadata) {
    // -------------------- Private State --------------------
    const { name, size, type } = metadata;
    let buffer;
    let offset = 0;
    let iosBlobParts;
    let writer;
    const threshold = isApple() ? 2 * 1024 * 1024 : 8 * 1024 * 1024;

    // -------------------- Internal Methods --------------------
    async function pushChunk(chunk) {
        // Implementation inside manager
    }

    async function finalize() {
        // Implementation inside manager
        // Returns Blob for iOS or closes writer for non-iOS
    }

    // -------------------- Public API --------------------
    return {
        pushChunk,
        finalize,
    };
}
