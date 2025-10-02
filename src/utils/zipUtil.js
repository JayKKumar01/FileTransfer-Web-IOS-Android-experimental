// zipUtil.js
// Assumes files: [{ metadata: { name }, status: { blobs: [Blob, ...] } }, ...]

// --- CRC32 TABLE (precomputed) ---
const crcTable = (() => {
    let c, crcTable = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[n] = c >>> 0;
    }
    return crcTable;
})();

function crc32(crc, buf) {
    let c = crc ^ -1;
    for (let i = 0; i < buf.length; i++) {
        c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return c ^ -1;
}

function uint16LE(num) {
    return [num & 0xff, (num >> 8) & 0xff];
}

function uint32LE(num) {
    return [
        num & 0xff,
        (num >> 8) & 0xff,
        (num >> 16) & 0xff,
        (num >> 24) & 0xff,
    ];
}

export async function createZip(files) {
    const fileData = [];
    const centralDirectory = [];
    let offset = 0;

    for (const fileIndex in files) {
        const file = files[fileIndex];
        const { blobs } = file.status;
        const { name } = file.metadata;
        const fileNameBytes = new TextEncoder().encode(name);

        // Local file header with placeholders (data descriptor flag = 8)
        const localHeader = new Uint8Array([
            0x50,0x4b,0x03,0x04,
            ...uint16LE(20),
            ...uint16LE(8),
            ...uint16LE(0),
            ...uint16LE(0),...uint16LE(0),
            ...uint32LE(0),
            ...uint32LE(0),
            ...uint32LE(0),
            ...uint16LE(fileNameBytes.length),
            ...uint16LE(0),
            ...fileNameBytes
        ]);

        fileData.push(localHeader);
        const localHeaderOffset = offset;
        offset += localHeader.length;

        // Process each blob part sequentially with progress
        let crc = 0;
        let totalSize = 0;
        for (let partIndex = 0; partIndex < blobs.length; partIndex++) {
            const blobPart = blobs[partIndex];
            const arrayBuffer = await blobPart.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);

            crc = crc32(crc, data);
            totalSize += data.length;
            fileData.push(data);
            offset += data.length;

            // Progress logging
            if (partIndex % 10 === 0 || partIndex === blobs.length - 1) {
                const percent = ((partIndex + 1) / blobs.length * 100).toFixed(1);
                console.log(`File ${parseInt(fileIndex)+1}/${files.length} "${name}": ${percent}%`);
                await Promise.resolve(); // yield to UI
            }
        }

        // Data descriptor
        const descriptor = new Uint8Array([
            0x50,0x4b,0x07,0x08,
            ...uint32LE(crc >>> 0),
            ...uint32LE(totalSize),
            ...uint32LE(totalSize)
        ]);
        fileData.push(descriptor);
        offset += descriptor.length;

        // Central directory entry
        const centralHeader = new Uint8Array([
            0x50,0x4b,0x01,0x02,
            ...uint16LE(20),
            ...uint16LE(20),
            ...uint16LE(8),
            ...uint16LE(0),
            ...uint16LE(0),...uint16LE(0),
            ...uint32LE(crc >>> 0),
            ...uint32LE(totalSize),
            ...uint32LE(totalSize),
            ...uint16LE(fileNameBytes.length),
            ...uint16LE(0),
            ...uint16LE(0),
            ...uint16LE(0),
            ...uint16LE(0),
            ...uint32LE(0),
            ...uint32LE(localHeaderOffset),
            ...fileNameBytes
        ]);
        centralDirectory.push(centralHeader);
    }

    const centralSize = centralDirectory.reduce((sum, part) => sum + part.length, 0);
    const centralOffset = offset;

    const endRecord = new Uint8Array([
        0x50,0x4b,0x05,0x06,
        ...uint16LE(0),
        ...uint16LE(0),
        ...uint16LE(files.length),
        ...uint16LE(files.length),
        ...uint32LE(centralSize),
        ...uint32LE(centralOffset),
        ...uint16LE(0)
    ]);

    const allParts = [...fileData, ...centralDirectory, endRecord];
    return new Blob(allParts, { type: "application/zip" });
}


// Public API: download zip
export async function downloadZip(files, zipName = "files.zip") {
    const zipBlob = await createZip(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
}
