/**
 * @typedef {Object} DownloadMetadata
 * @property {string} name - File name
 * @property {number} size - File size in bytes
 * @property {string} type - MIME type
 */

/**
 * @typedef {Object} DownloadStatus
 * @property {"waiting"|"receiving"|"received"|"failed"} state - Current transfer state
 * @property {number} progress - Bytes received so far
 * @property {Blob|null} [blob] - Fully received file as a Blob (optional)
 * @property {string} [error] - Optional error message if transfer failed
 * @property {number} [speed] - Current download speed in bytes/sec (optional)
 */

/**
 * @typedef {Object} DownloadTrackingManager
 * Optimized tracking object returned by createTrackingManager
 * @property {(chunkSize:number)=>void} addBytes - Add bytes from a received chunk
 * @property {()=>number} getProgress - Get current progress in bytes
 * @property {()=>number} getTotalSize - Get total file size in bytes
 * @property {()=>number} getSpeed - Get current download speed in bytes/sec
 * @property {()=>boolean} isComplete - Check if download is complete
 * @property {()=>boolean} shouldUpdateUI - Check if enough time has passed to update the UI
 * @property {()=>void} reset - Reset the manager state (for retries)
 */

/**
 * @typedef {Object} DownloadStorageManager
 * Encapsulates storage and chunk handling
 * @property {(chunk:Uint8Array|ArrayBuffer)=>Promise<void>} pushChunk - Add a new chunk of data
 * @property {()=>Promise<Blob|null>} finalize - Finalize storage and return Blob (iOS) or null (non-iOS)
 */

/**
 * @typedef {Object} DownloadItem
 * @property {string} id - Unique identifier for the file
 * @property {DownloadMetadata} metadata - Immutable file details
 * @property {DownloadStatus} status - Tracks download progress
 * @property {DownloadTrackingManager} trackingManager - UI tracking manager
 * @property {DownloadStorageManager} storageManager - Storage manager for chunks
 */

/**
 * @typedef {DownloadItem[]} DownloadList - Array of download items
 */
