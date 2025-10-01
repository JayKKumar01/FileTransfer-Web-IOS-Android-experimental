/**
 * @typedef {Object} DownloadMetadata
 * @property {string} name - File name
 * @property {number} size - File size in bytes
 * @property {string} type - MIME type
 */

/**
 * @typedef {Object} DownloadStatus
 * @property {"pending"|"receiving"|"received"|"failed"} state - Current transfer state
 * @property {number} progress - Bytes received so far
 * @property {Blob|null} [blob] - Fully received file as a Blob (optional)
 * @property {string} [error] - Optional error message if transfer failed
 * @property {number} [speed] - Optional: current download speed
 */

/**
 * @typedef {Object} DownloadTrackingManager
 * @property {number} bytesReceived - Bytes received so far (for UI)
 * @property {{lastBytes:number,lastTime:number}} speed - For speed calculation
 * @property {number} uiThrottle - Timestamp for throttling UI updates
 */

/**
 * @typedef {Object} DownloadStorageManager
 * @property {Uint8Array} buffer - Current buffer for accumulating chunks
 * @property {number} offset - Current offset in the buffer
 * @property {Blob[]} [iosBlobParts] - Only for iOS, parts of the final Blob
 * @property {WritableStreamDefaultWriter|null} [writer] - Only for non-iOS streaming
 */

/**
 * @typedef {Object} DownloadItem
 * @property {string} id - Unique identifier for the file
 * @property {DownloadMetadata} metadata - Immutable file details
 * @property {DownloadStatus} status - Tracks download progress
 * @property {DownloadTrackingManager} trackingManager - UI tracking
 * @property {DownloadStorageManager} storageManager - Buffer/storage tracking
 */

/**
 * @typedef {DownloadItem[]} DownloadList - Array of download items
 */
