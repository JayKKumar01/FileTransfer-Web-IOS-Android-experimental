import React, { useState, useRef, useContext } from "react";
import { LogContext } from "../contexts/LogContext";

const CHUNK_SIZE = 256 * 1024; // 256 KB
// Full list of files from 1MB to 20MB
const TEST_FILE_SIZES_MB = Array.from({ length: 20 }, (_, i) => i + 1);

class VirtualFile {
    constructor(sizeMB) {
        this.size = sizeMB * 1024 * 1024;
        this.name = `Virtual_${sizeMB}MB.bin`;
    }
    slice(start, end) {
        return new Blob([new Uint8Array(Math.max(0, end - start))]);
    }
}

const AndroidChunkSpeedTest = () => {
    const { pushLog } = useContext(LogContext);
    const latestChunkRef = useRef(null);
    const [progress, setProgress] = useState(0);

    const log = (msg) => {
        console.log(msg);
        pushLog(msg);
    };

    const processBuffer = async (buffer, fileSize) => {
        let offset = 0;
        while (offset < buffer.size) {
            const end = Math.min(offset + CHUNK_SIZE, buffer.size);
            latestChunkRef.current = buffer.slice(offset, end);
            offset += end - offset;
            setProgress(Math.floor((offset / fileSize) * 100));
            await new Promise((r) => setTimeout(r, 0));
        }
    };

    const runAllTests = async () => {
        for (const sizeMB of TEST_FILE_SIZES_MB) {
            const file = new VirtualFile(sizeMB);
            log(`\n--- File: ${sizeMB} MB ---`);
            const batches = [2, 4, 8];

            for (const batchMB of batches) {
                setProgress(0);
                const startTime = performance.now();
                await processBuffer(file.slice(0, file.size), file.size);
                const totalTime = (performance.now() - startTime) / 1000;
                const speed = totalTime ? ((file.size / (1024 * 1024)) / totalTime).toFixed(2) : "N/A";
                log(`Batch ${batchMB} MB | Time: ${totalTime.toFixed(2)}s | Speed: ${speed} MB/s`);
            }
        }
        log("\n--- All tests completed ---");
        setProgress(0);
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: 40,
                fontFamily: "Arial, sans-serif",
                height: "100vh",
                backgroundColor: "#12121b",
                color: "#fff",
                textAlign: "center",
            }}
        >
            <button
                onClick={runAllTests}
                style={{
                    padding: "12px 24px",
                    backgroundColor: "#1976d2",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    marginBottom: 30,
                    fontSize: 16,
                    fontWeight: 600,
                }}
            >
                Run Small File Tests
            </button>

            <div
                style={{
                    width: "60%",
                    height: 24,
                    backgroundColor: "#2e2e3e",
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 20,
                }}
            >
                <div
                    style={{
                        width: `${progress}%`,
                        height: "100%",
                        backgroundColor: "#4caf50",
                        transition: "width 0.1s linear",
                    }}
                />
            </div>

            <div style={{ fontSize: 14, marginBottom: 20 }}>
                {progress > 0 ? `Current Progress: ${progress}%` : "Waiting for test..."}
            </div>

            <div style={{ maxWidth: 600, wordBreak: "break-all", fontSize: 14, color: "#b0b0c0" }}>
                {latestChunkRef.current ? (
                    <div>Latest Chunk Size: {latestChunkRef.current.size} bytes</div>
                ) : (
                    <div>No chunk loaded yet</div>
                )}
            </div>
        </div>
    );
};

export default AndroidChunkSpeedTest;
