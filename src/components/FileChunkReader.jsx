import React, { useState, useContext, useRef } from "react";
import { LogContext } from "../contexts/LogContext";

// ===== Global Constants =====
const CHUNK_SIZE = 256 * 1024; // 256 KB
const ANDROID_REGEX = /Android/i;

// Optimal batch: >=8 MB → 8 MB, <8 MB → file size
const getOptimalBatch = (fileSizeMB) => (fileSizeMB >= 8 ? 8 : fileSizeMB);

const FileChunkReader = () => {
    const { pushLog } = useContext(LogContext);
    const [progress, setProgress] = useState(0);
    const latestChunkRef = useRef(null);

    const isAndroid = ANDROID_REGEX.test(navigator.userAgent);

    const log = (msg) => {
        console.log(msg);
        pushLog(msg);
    };

    const processBuffer = async (buffer, fileSize, offsetStart = 0) => {
        let offset = offsetStart;
        let lastPercent = Math.floor((offset / fileSize) * 100);

        for (let i = 0; i < buffer.byteLength; i += CHUNK_SIZE) {
            const end = Math.min(i + CHUNK_SIZE, buffer.byteLength);
            const chunk = buffer.slice(i, end);
            latestChunkRef.current = chunk;
            offset += chunk.byteLength;

            const percent = Math.floor((offset / fileSize) * 100);
            if (percent !== lastPercent) {
                lastPercent = percent;
                setProgress(percent);
                log(`Read ${chunk.byteLength} bytes, Progress: ${percent}%`);
            }
        }

        return offset;
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileSizeMB = file.size / (1024 * 1024);
        const batchSizeMB = getOptimalBatch(fileSizeMB);
        const batchBytes = Math.min(batchSizeMB * 1024 * 1024, file.size);

        log(`Selected file: ${file.name} (${fileSizeMB.toFixed(2)} MB), Batch: ${batchSizeMB} MB`);

        let offset = 0;
        const startTime = performance.now();

        try {
            if (isAndroid) {
                log(`Using Android batch reading (${batchSizeMB} MB batches)`);
                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + batchBytes, file.size));
                    const buffer = await slice.arrayBuffer();
                    offset = await processBuffer(buffer, file.size, offset);

                    // Yield for UI
                    await new Promise((r) => setTimeout(r, 0));
                }
            } else {
                log("Using sequential reading (256 KB chunks)");
                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
                    const buffer = await slice.arrayBuffer();
                    offset = await processBuffer(buffer, file.size, offset);
                }
            }

            setProgress(100);
            const totalTime = (performance.now() - startTime) / 1000;
            const speedMBps = totalTime > 0 ? (fileSizeMB / totalTime).toFixed(2) : "N/A";

            log(`File read complete. Time: ${totalTime.toFixed(2)}s, Speed: ${speedMBps} MB/s`);
        } catch (err) {
            log(`Error reading file: ${err}`);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", padding: 20, flex: 1, fontFamily: "Arial, sans-serif" }}>
            <input type="file" onChange={handleFileSelect} style={{ marginBottom: 20 }} />

            <div style={{ width: "100%", height: 24, backgroundColor: "#e0e0e0", borderRadius: 12, overflow: "hidden", marginBottom: 15 }}>
                <div style={{ width: `${progress}%`, height: "100%", backgroundColor: "#4caf50", transition: "width 0.1s linear" }}></div>
            </div>

            <div style={{ fontSize: 14, marginBottom: 15 }}>{progress > 0 ? `Progress: ${progress}%` : "Waiting for file..."}</div>

            <div style={{ flex: 1, overflow: "auto", fontSize: 14, color: "#b0b0c0", wordBreak: "break-all" }}>
                {latestChunkRef.current ? <div>Latest Chunk Size: {latestChunkRef.current.byteLength} bytes</div> : <div>No chunk loaded yet</div>}
            </div>
        </div>
    );
};

export default FileChunkReader;
