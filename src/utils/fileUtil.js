import {crc32} from "./zipUtil";

export const formatFileSize = (bytes) => {
    if (bytes === 0 || bytes == null) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure division does not produce NaN for very small numbers
    const size = bytes / Math.pow(k, i);

    // Keep two decimals only for sizes >= 1 KB
    const formattedSize = i === 0 ? size : size.toFixed(2);

    return `${formattedSize} ${sizes[i]}`;
};
function fillRandom(buffer) {
    const MAX_BYTES = 65536; // browser limit
    for (let i = 0; i < buffer.length; i += MAX_BYTES) {
        const chunk = buffer.subarray(i, i + MAX_BYTES);
        crypto.getRandomValues(chunk);
    }
}

export async function simulateFiles(numFiles, partsPerFile, partSizeMB) {
    const files = [];
    const totalChunks = numFiles * partsPerFile;
    let processedChunks = 0;

    for (let i = 0; i < numFiles; i++) {
        const blobs = [];
        let crc = 0;

        for (let j = 0; j < partsPerFile; j++) {
            // Create random buffer for realistic CRC values
            const buffer = new Uint8Array(partSizeMB * 1024 * 1024);
            fillRandom(buffer);

            crc = crc32(crc, buffer);
            blobs.push(new Blob([buffer], { type: "application/octet-stream" }));

            // --- Console progress ---
            processedChunks++;
            const percent = ((processedChunks / totalChunks) * 100).toFixed(2);
            console.log(`Simulating files: ${percent}%`);
            await Promise.resolve(); // yield to UI
        }

        const totalSize = blobs.reduce((sum, b) => sum + b.size, 0);

        files.push({
            id: `file-${i + 1}`,
            metadata: {
                name: `file_${i + 1}.bin`,
                size: totalSize,
                type: "application/octet-stream"
            },
            status: {
                blobs,
                crc: crc >>> 0 // ensure unsigned
            }
        });
    }

    return files;
}

