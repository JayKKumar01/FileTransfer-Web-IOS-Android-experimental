// src/interfaces/file.js

/**
 * @typedef {Object} FileMetadata
 * @property {string} name - File name
 * @property {number} size - File size in bytes
 * @property {string} type - MIME type
 */

/**
 * @typedef {Object} FileStatus
 * @property {"pending"|"sending"|"completed"|"failed"} state - Current transfer state
 * @property {number} progress - Bytes sent so far
 * @property {string} [error] - Optional error information
 */

/**
 * @typedef {Object} FileItem
 * @property {string} id - Unique identifier for the file
 * @property {File} file - Actual File object
 * @property {FileMetadata} metadata - Immutable file details
 * @property {boolean} metaSent - Whether metadata has been sent to remote
 * @property {FileStatus} status - Dynamic transfer state
 */
