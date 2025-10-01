// blobWorker.js
self.onmessage = async (e) => {
    const { type, fileId, fileName, mimeType, parts } = e.data;

    if (type === 'finalize') {
        const totalParts = parts.length;
        const kept = [];

        for (let i = 0; i < totalParts; i++) {
            kept.push(parts[i]);
            // send progress update every 10 parts or so
            if (i % 10 === 0 || i === totalParts - 1) {
                self.postMessage({
                    type: 'progress',
                    phase: 'finalizing',
                    fileId,
                    done: i + 1,
                    total: totalParts,
                    percent: Math.round(((i + 1) / totalParts) * 100)
                });
                await new Promise(r => setTimeout(r, 0)); // yield to event loop
            }
        }

        // finally create one Blob
        const finalBlob = new Blob(kept, { type: mimeType });
        self.postMessage({ type: 'done', fileId, fileName, blob: finalBlob });
    }
};
