// zipUtil.js

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

function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
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

async function createZip(files) {
    let fileData = [];
    let centralDirectory = [];
    let offset = 0;

    for (const file of files) {
        const { blob } = file.status;
        const { name } = file.metadata;

        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const crc = crc32(data);
        const compressedSize = data.length;
        const uncompressedSize = data.length;
        const fileNameBytes = new TextEncoder().encode(name);

        // Local file header
        const localHeader = new Uint8Array([
            ...[0x50, 0x4b, 0x03, 0x04], // Local file header signature
            ...uint16LE(20),             // Version needed
            ...uint16LE(0),              // Flags
            ...uint16LE(0),              // Compression method (0 = store)
            ...uint16LE(0), ...uint16LE(0), // File mod time/date
            ...uint32LE(crc),
            ...uint32LE(compressedSize),
            ...uint32LE(uncompressedSize),
            ...uint16LE(fileNameBytes.length),
            ...uint16LE(0),              // Extra field length
            ...fileNameBytes
        ]);

        fileData.push(localHeader, data);

        // Central directory header
        const centralHeader = new Uint8Array([
            ...[0x50, 0x4b, 0x01, 0x02], // Central file header signature
            ...uint16LE(20),             // Version made by
            ...uint16LE(20),             // Version needed to extract
            ...uint16LE(0),              // General purpose bit flag
            ...uint16LE(0),              // Compression method
            ...uint16LE(0), ...uint16LE(0), // File time/date
            ...uint32LE(crc),
            ...uint32LE(compressedSize),
            ...uint32LE(uncompressedSize),
            ...uint16LE(fileNameBytes.length),
            ...uint16LE(0),              // Extra field length
            ...uint16LE(0),              // File comment length
            ...uint16LE(0),              // Disk number start
            ...uint16LE(0),              // Internal file attrs
            ...uint32LE(0),              // External file attrs
            ...uint32LE(offset),         // Relative offset of local header
            ...fileNameBytes
        ]);

        centralDirectory.push(centralHeader);
        offset += localHeader.length + data.length;
    }

    const centralSize = centralDirectory.reduce((sum, part) => sum + part.length, 0);
    const centralOffset = offset;

    // End of central directory record
    const endRecord = new Uint8Array([
        ...[0x50, 0x4b, 0x05, 0x06],
        ...uint16LE(0), // Disk number
        ...uint16LE(0), // Disk with central dir
        ...uint16LE(files.length),
        ...uint16LE(files.length),
        ...uint32LE(centralSize),
        ...uint32LE(centralOffset),
        ...uint16LE(0)  // Comment length
    ]);

    const allParts = [...fileData, ...centralDirectory, endRecord];
    return new Blob(allParts, { type: "application/zip" });
}

// --- Public API ---
export async function downloadZip(files, zipName = "files.zip") {
    const zipBlob = await createZip(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
}
