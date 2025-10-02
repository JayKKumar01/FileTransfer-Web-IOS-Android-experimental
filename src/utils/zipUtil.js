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

/**
 * Incremental CRC32 calculation
 * @param {number} crc - previous CRC32 (0 for new)
 * @param {Uint8Array | number[]} buf - bytes to update
 * @returns {number} - updated CRC32
 */
export function crc32(crc, buf) {
    let c = crc ^ -1;
    for (let i = 0; i < buf.length; i++) {
        c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return c ^ -1;
}

/**
 * Convert number to 2-byte little-endian array
 * @param {number} num
 * @returns {number[]}
 */
export function uint16LE(num) {
    return [num & 0xff, (num >> 8) & 0xff];
}

/**
 * Convert number to 4-byte little-endian array
 * @param {number} num
 * @returns {number[]}
 */
export function uint32LE(num) {
    return [
        num & 0xff,
        (num >> 8) & 0xff,
        (num >> 16) & 0xff,
        (num >> 24) & 0xff,
    ];
}

// --- Core function to create ZIP (with ZIP64 support) ---
export async function createZip(files, onProgress, onZipped) {
    const fileParts = [];
    const centralDirectory = [];
    let offset = 0;
    const totalBlobs = files.reduce((sum, f) => sum + f.status.blobs.length, 0);
    let processedBlobs = 0;
    const nameCountMap = {};

    function uint64LE(num) {
        const low = num >>> 0;                   // lower 32 bits
        const high = Math.floor(num / 0x100000000); // upper 32 bits
        return [
            low & 0xff,
            (low >> 8) & 0xff,
            (low >> 16) & 0xff,
            (low >> 24) & 0xff,
            high & 0xff,
            (high >> 8) & 0xff,
            (high >> 16) & 0xff,
            (high >> 24) & 0xff,
        ];
    }

    for (const file of files) {
        const { blobs, crc } = file.status;
        let { name } = file.metadata;
        const { size } = file.metadata;

        // Handle duplicate names
        if (nameCountMap[name]) {
            const extIndex = name.lastIndexOf(".");
            const baseName = extIndex !== -1 ? name.slice(0, extIndex) : name;
            const ext = extIndex !== -1 ? name.slice(extIndex) : "";
            name = `${baseName} (${nameCountMap[name]})${ext}`;
            nameCountMap[file.metadata.name] += 1;
        } else {
            nameCountMap[name] = 1;
        }

        const fileNameBytes = new TextEncoder().encode(name);
        const useZIP64 = size >= 0xFFFFFFFF; // Use >= instead of >

        // --- Local File Header ---
        const versionNeeded = useZIP64 ? 0x002D : 0x0014; // 45 for ZIP64

        // Build ZIP64 extra field for local header
        let zip64ExtraField = new Uint8Array(0);
        if (useZIP64) {
            zip64ExtraField = new Uint8Array([
                ...uint16LE(0x0001), // ZIP64 extended information tag
                ...uint16LE(16),     // Size of extra data (2x 8-byte = 16 bytes)
                ...uint64LE(size),   // Original uncompressed size (64-bit)
                ...uint64LE(size)    // Compressed size (64-bit)
            ]);
        }

        const localHeader = new Uint8Array([
            0x50, 0x4B, 0x03, 0x04, // Local file header signature
            ...uint16LE(versionNeeded), // Version needed to extract
            ...uint16LE(0x0008),     // General purpose bit flag (bit 3 = data descriptor)
            ...uint16LE(0x0000),     // Compression method (0 = stored)
            ...uint16LE(0x0000),     // Last mod file time
            ...uint16LE(0x0000),     // Last mod file date
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : (crc >>> 0)), // CRC-32
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : size), // Compressed size
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : size), // Uncompressed size
            ...uint16LE(fileNameBytes.length), // File name length
            ...uint16LE(zip64ExtraField.length), // Extra field length
            ...fileNameBytes,        // File name
            ...zip64ExtraField       // Extra field
        ]);

        fileParts.push(new Blob([localHeader]));
        const localHeaderOffset = offset;
        offset += localHeader.length;

        // Append file data
        for (const blob of blobs) {
            fileParts.push(blob);
            offset += blob.size;
            processedBlobs++;
            if (onProgress && (processedBlobs % 5 === 0 || processedBlobs === totalBlobs)) {
                const percent = Math.min((processedBlobs / totalBlobs) * 100, 100);
                onProgress(Number(percent.toFixed(2)));
                await Promise.resolve();
            }
        }

        // --- Data Descriptor ---
        let descriptor;
        if (useZIP64) {
            descriptor = new Uint8Array([
                0x50, 0x4B, 0x07, 0x08, // Data descriptor signature
                ...uint32LE(crc >>> 0),  // CRC-32
                ...uint64LE(size),       // Compressed size (64-bit)
                ...uint64LE(size)        // Uncompressed size (64-bit)
            ]);
        } else {
            descriptor = new Uint8Array([
                0x50, 0x4B, 0x07, 0x08, // Data descriptor signature
                ...uint32LE(crc >>> 0),  // CRC-32
                ...uint32LE(size),       // Compressed size
                ...uint32LE(size)        // Uncompressed size
            ]);
        }
        fileParts.push(new Blob([descriptor]));
        offset += descriptor.length;

        if (onZipped) onZipped(file.id);

        // --- Central Directory Header ---
        let zip64CentralExtraField = new Uint8Array(0);
        if (useZIP64) {
            zip64CentralExtraField = new Uint8Array([
                ...uint16LE(0x0001),     // ZIP64 extended information tag
                ...uint16LE(24),         // Size of extra data (3x 8-byte = 24 bytes)
                ...uint64LE(size),       // Original uncompressed size
                ...uint64LE(size),       // Compressed size
                ...uint64LE(localHeaderOffset) // Relative offset of local header
            ]);
        }

        const centralHeader = new Uint8Array([
            0x50, 0x4B, 0x01, 0x02, // Central file header signature
            ...uint16LE(0x0014),     // Version made by (2.0)
            ...uint16LE(versionNeeded), // Version needed to extract
            ...uint16LE(0x0008),     // General purpose bit flag (bit 3 = data descriptor)
            ...uint16LE(0x0000),     // Compression method
            ...uint16LE(0x0000),     // Last mod file time
            ...uint16LE(0x0000),     // Last mod file date
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : (crc >>> 0)), // CRC-32
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : size), // Compressed size
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : size), // Uncompressed size
            ...uint16LE(fileNameBytes.length), // File name length
            ...uint16LE(zip64CentralExtraField.length), // Extra field length
            ...uint16LE(0x0000),     // File comment length
            ...uint16LE(0x0000),     // Disk number start
            ...uint16LE(0x0000),     // Internal file attributes
            ...uint32LE(0x00000000), // External file attributes
            ...uint32LE(useZIP64 ? 0xFFFFFFFF : localHeaderOffset), // Relative offset of local header
            ...fileNameBytes,         // File name
            ...zip64CentralExtraField // Extra field
        ]);
        centralDirectory.push(new Blob([centralHeader]));
    }

    const centralSize = centralDirectory.reduce((sum, b) => sum + b.size, 0);
    const centralOffset = offset;
    const totalEntries = files.length;
    const useZIP64ForCentral = centralSize >= 0xFFFFFFFF || centralOffset >= 0xFFFFFFFF || totalEntries >= 0xFFFF;

    // Build final parts
    const allParts = [...fileParts, ...centralDirectory];

    if (useZIP64ForCentral) {
        // ZIP64 End of Central Directory Record
        const zip64EOCDR = new Uint8Array([
            0x50, 0x4B, 0x06, 0x06, // ZIP64 EOCD signature
            ...uint64LE(44),         // Size of this record (excluding signature and this field)
            ...uint16LE(0x002D),     // Version made by (4.5)
            ...uint16LE(0x002D),     // Version needed to extract (4.5)
            ...uint32LE(0x00000000), // Number of this disk
            ...uint32LE(0x00000000), // Disk where central directory starts
            ...uint64LE(totalEntries), // Number of central directory records on this disk
            ...uint64LE(totalEntries), // Total number of central directory records
            ...uint64LE(centralSize), // Size of central directory
            ...uint64LE(centralOffset) // Offset of start of central directory
        ]);

        // ZIP64 End of Central Directory Locator
        const zip64EOCDL = new Uint8Array([
            0x50, 0x4B, 0x06, 0x07, // ZIP64 EOCD locator signature
            ...uint32LE(0x00000000), // Number of disk with ZIP64 EOCD
            ...uint64LE(centralOffset + centralSize), // Offset of ZIP64 EOCD
            ...uint32LE(0x00000001)  // Total number of disks
        ]);

        allParts.push(new Blob([zip64EOCDR]));
        allParts.push(new Blob([zip64EOCDL]));
    }

    // End of Central Directory Record
    const endRecord = new Uint8Array([
        0x50, 0x4B, 0x05, 0x06, // EOCD signature
        ...uint16LE(useZIP64ForCentral ? 0xFFFF : 0x0000), // Number of this disk
        ...uint16LE(useZIP64ForCentral ? 0xFFFF : 0x0000), // Disk where central directory starts
        ...uint16LE(useZIP64ForCentral ? 0xFFFF : totalEntries), // Number of CD records on this disk
        ...uint16LE(useZIP64ForCentral ? 0xFFFF : totalEntries), // Total number of CD records
        ...uint32LE(useZIP64ForCentral ? 0xFFFFFFFF : centralSize), // Size of central directory
        ...uint32LE(useZIP64ForCentral ? 0xFFFFFFFF : centralOffset), // Offset of start of central directory
        ...uint16LE(0x0000) // ZIP file comment length
    ]);

    allParts.push(new Blob([endRecord]));

    return new Blob(allParts, { type: "application/zip" });
}

// --- Public API: download zip with progress callback ---
export async function downloadZip(files, onProgress, onZipped) {
    const zipBlob = await createZip(files, onProgress, onZipped);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
    a.download = `github.jaykkumar01.${dateStr}.zip`;
    a.click();
    URL.revokeObjectURL(url);
}