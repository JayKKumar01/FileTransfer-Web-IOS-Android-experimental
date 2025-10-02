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


function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fillRandomAsync(buffer) {
    const MAX_BYTES = 65536;
    for (let i = 0; i < buffer.length; i += MAX_BYTES) {
        const chunk = buffer.subarray(i, i + MAX_BYTES);
        crypto.getRandomValues(chunk);

        // Yield to UI every ~1MB
        if (i % (MAX_BYTES * 16) === 0) {
            await sleep(0);
        }
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
            const buffer = new Uint8Array(partSizeMB * 1024 * 1024);
            await fillRandomAsync(buffer); // yield while generating

            crc = crc32(crc, buffer);
            blobs.push(new Blob([buffer], { type: "application/octet-stream" }));

            processedChunks++;
            const percent = ((processedChunks / totalChunks) * 100).toFixed(2);
            console.log(`Simulating files: ${percent}%`);

            // Yield after each chunk
            await sleep(0);
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
                crc: crc >>> 0
            }
        });
    }

    return files;
}


