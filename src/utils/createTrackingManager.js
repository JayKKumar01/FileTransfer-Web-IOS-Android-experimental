/**
 * Creates a tracking manager for a single download
 * Optimized for performance and minimal memory overhead
 * @param {Object} options
 * @param {number} options.totalSize - Total size of the file in bytes
 * @param {number} [options.uiUpdateInterval=166] - Minimum ms between UI updates (~6 FPS)
 */
export function createTrackingManager({ totalSize, uiUpdateInterval = 1000 / 6 }) {
    let bytesReceived = 0;
    let lastBytes = 0;
    let lastTime = performance.now();
    let currentSpeed = 0;
    let uiThrottle = 0;

    /**
     * Add bytes from a received chunk
     * @param {number} chunkSize
     */
    function addBytes(chunkSize) {
        bytesReceived += chunkSize;

        const now = performance.now();
        const deltaTime = (now - lastTime) / 1000;

        if (deltaTime > 0) {
            currentSpeed = (bytesReceived - lastBytes) / deltaTime;
            lastBytes = bytesReceived;
            lastTime = now;
        }
    }

    /**
     * Get current progress in bytes
     */
    function getProgress() {
        return bytesReceived;
    }

    /**
     * Get total size
     */
    function getTotalSize() {
        return totalSize;
    }

    /**
     * Get current speed in bytes/sec
     */
    function getSpeed() {
        return currentSpeed;
    }

    /**
     * Check if download is complete
     */
    function isComplete() {
        console.log(`Checking if complete: ${bytesReceived} >= ${totalSize}`);
        return bytesReceived >= totalSize;
    }

    /**
     * Check if enough time has passed to update the UI
     */
    function shouldUpdateUI() {
        const now = performance.now();
        if (now - uiThrottle >= uiUpdateInterval) {
            uiThrottle = now;
            return true;
        }
        return false;
    }

    /**
     * Optionally reset the manager (e.g., for retries)
     */
    function reset() {
        bytesReceived = 0;
        lastBytes = 0;
        lastTime = performance.now();
        currentSpeed = 0;
        uiThrottle = 0;
    }

    return {
        addBytes,
        getProgress,      // returns bytes received
        getTotalSize,     // returns total size
        getSpeed,
        isComplete,
        shouldUpdateUI,
        reset,
    };
}
