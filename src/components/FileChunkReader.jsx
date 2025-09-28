import React, { useState, useContext, useRef } from "react";
import { LogContext } from "../contexts/LogContext";

// ===== Global Constants =====
const DEFAULT_BATCH_SIZE = 2 * 1024 * 1024;   // 2 MB
const CHUNK_SIZE = 256 * 1024;                // 256 KB
const MAX_SAFE_BATCH = 96 * 1024 * 1024;      // 96 MB
const ANDROID_REGEX = /Android/i;

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

        for (let batchOffset = 0; batchOffset < buffer.byteLength; batchOffset += CHUNK_SIZE) {
            const end = Math.min(batchOffset + CHUNK_SIZE, buffer.byteLength);
            const chunk = buffer.slice(batchOffset, end);

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

    const getDynamicBatchSize = (fileSize) => {
        if (!isAndroid) return CHUNK_SIZE;
        return Math.min(
            Math.max(fileSize / 50, DEFAULT_BATCH_SIZE),
            Math.min(MAX_SAFE_BATCH, fileSize) // never exceed file size
        );
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        log(`Selected file: ${file.name} (${file.size} bytes)`);
        const startTime = performance.now();
        let offset = 0;

        const dynamicBatchSize = getDynamicBatchSize(file.size);

        try {
            if (isAndroid) {
                log(`Using Android batch reading (${(dynamicBatchSize / (1024 * 1024)).toFixed(1)} MB batches)`);
                while (offset < file.size) {
                    const slice = file.slice(offset, Math.min(offset + dynamicBatchSize, file.size));
                    const batchBuffer = await slice.arrayBuffer();
                    offset = await processBuffer(batchBuffer, file.size, offset);

                    // Yield for UI responsiveness
                    await new Promise(r => setTimeout(r, 0));
                }
            } else {
                log("Using sequential reading (256 KB chunks)");
                while (offset < file.size) {
                    const slice = file.slice(offset, offset + CHUNK_SIZE);
                    const chunk = await slice.arrayBuffer();
                    offset = await processBuffer(chunk, file.size, offset);
                }
            }

            setProgress(100);
            const totalTime = (performance.now() - startTime) / 1000;
            const fileSizeMB = file.size / (1024 * 1024);
            const speedMBps = totalTime > 0 ? (fileSizeMB / totalTime).toFixed(2) : "N/A";
            log(
                `File reading completed. File size: ${file.size} bytes (${fileSizeMB.toFixed(2)} MB), ` +
                `Total time: ${totalTime.toFixed(2)}s, Speed: ${speedMBps} MB/s`
            );
        } catch (err) {
            log(`Error reading file: ${err}`);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", padding: 10, flex: 1, fontFamily: "Arial, sans-serif" }}>
            <input type="file" onChange={handleFileSelect} style={{ marginBottom: 15, alignSelf: "flex-start" }} />

            <div style={{ width: "100%", height: 20, backgroundColor: "#e0e0e0", borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: `${progress}%`, height: "100%", backgroundColor: "#4caf50", transition: "width 0.1s linear" }}></div>
            </div>

            <div style={{ fontSize: 14, marginBottom: 10 }}>{progress}% completed</div>

            <div style={{ flex: 1, overflow: "auto" }}>
                {latestChunkRef.current ? (
                    <div style={{ wordBreak: "break-all" }}>
                        <strong>Latest Chunk Size:</strong> {latestChunkRef.current.byteLength} bytes
                    </div>
                ) : (
                    <div>No chunk loaded yet</div>
                )}
            </div>
        </div>
    );
};

export default FileChunkReader;
