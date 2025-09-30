// src/interfaces/download.js

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
 * @property {string} [error] - Optional error message if transfer failed
 */

/**
 * @typedef {Object} DownloadItem
 * @property {string} id - Unique identifier for the file (matches sender's file ID)
 * @property {DownloadMetadata} metadata - Immutable file details
 * @property {DownloadStatus} status - Tracks download progress
 */

/**
 * @typedef {DownloadItem[]} DownloadList - Array of download items
 */
