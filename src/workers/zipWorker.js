/* eslint-disable no-restricted-globals */
import JSZip from "jszip";

self.onmessage = async (e) => {
    const { files } = e.data;
    const zip = new JSZip();

    let totalSize = 0;
    files.forEach(f => totalSize += f.blob.size);
    let processed = 0;

    for (const f of files) {
        // Add each file directly - JSZip handles streaming internally
        zip.file(f.name, f.blob, { binary: true });
        processed += f.blob.size;
        self.postMessage({ percent: Math.floor((processed / totalSize) * 100) });
        await new Promise(r => setTimeout(r, 0));
    }

    // Use compression and streaming to minimize memory
    const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
        streamFiles: true  // This helps with memory for large files
    });

    self.postMessage({ done: true, blob: content });
};