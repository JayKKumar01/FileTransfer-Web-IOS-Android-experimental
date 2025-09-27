import React, { useState, useContext } from "react";
import { LogContext } from "../contexts/LogContext";
import {
    deleteDatabase,
    createStore,
    saveChunk,
    getBlob,
    clearChunks,
    getName,
    flush,
    getInfo, refreshIOSStorage
} from "../utils/chunkUtil";

const useLogger = () => {
    const { pushLog } = useContext(LogContext);
    return (msg) => {
        console.log(msg);
        pushLog(msg);
    };
};

const chunkOptions = [
    { label: "64 KB", value: 64 * 1024 },
    { label: "128 KB", value: 128 * 1024 },
    { label: "256 KB", value: 256 * 1024 },
    { label: "512 KB", value: 512 * 1024 },
    { label: "1 MB", value: 1024 * 1024 },
    { label: "2 MB", value: 2 * 1024 * 1024 },
    { label: "4 MB", value: 4 * 1024 * 1024 },
];

// --- File chunk generator ---
async function* chunkFile(file, size) {
    let offset = 0;
    while (offset < file.size) {
        yield file.slice(offset, offset + size);
        offset += size;
    }
}

const FileSender = () => {
    const [sendProgress, setSendProgress] = useState(0);
    const [assembleProgress, setAssembleProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [fileSize, setFileSize] = useState(0);
    const [sendChunkSize, setSendChunkSize] = useState(2 * 1024 * 1024); // default 2 MB

    const log = useLogger();

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const newFileId = Date.now().toString();
        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);
        setFileSize(file.size);

        try {
            await createStore(newFileId, file.name);

            let processed = 0;
            let lastPercent = 0;

            for await (const slice of chunkFile(file, sendChunkSize)) {
                await saveChunk(newFileId, slice);
                processed += slice.size;

                // update progress only when percent actually changes
                const percent = Math.floor((processed / file.size) * 100);
                if (percent !== lastPercent) {
                    lastPercent = percent;
                    setSendProgress(percent);
                }
            }

            await flush(newFileId);

            setStatus("completed");
            log(`✅ File sent → fileId: ${newFileId}, size: ${file.size} bytes`);
        } catch (err) {
            log(`❌ Error sending file: ${err.message}`);
            setStatus("error");
        }
    };

    const handleDownload = async () => {
        if (!fileId) return alert("No file available");

        setAssembleProgress(0);
        setStatus("assembling");

        try {
            const name = await getName(fileId);
            const assembledBlob = await getBlob(fileId, "application/octet-stream", (processed, total) => {
                const percent = Math.floor((processed / total) * 100);
                setAssembleProgress(percent);
            });

            let url = URL.createObjectURL(assembledBlob);
            let a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            // Force garbage collection by revoking URL and removing element
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // Nullify references to help garbage collection
                a = null;
                url = null;
            }, 100);

            log(`⬇️ Downloaded: ${name}, size: ${assembledBlob.size}`);

            // reset state
            setFileId(null);
            setFileName(null);
            setFileSize(0);
            setSendProgress(0);
            setAssembleProgress(0);
            setStatus("idle");

            const afterInfo = await getInfo(fileId);
            log('After clear:\n' + JSON.stringify(afterInfo, null, 2));

            const refreshed = await refreshIOSStorage();
            if (refreshed) {
                log("iOS storage view refreshed successfully.");
            }


        } catch (err) {
            log(`❌ Error downloading file: ${err.message}`);
            setStatus("error");
        }
    };

    return (
        <div style={{ padding: "16px", fontFamily: "Arial" }}>
            <input
                type="file"
                onChange={handleFileSelect}
                style={{ marginBottom: "12px", padding: "6px", border: "1px solid #ccc", borderRadius: "6px" }}
            />

            <select
                value={sendChunkSize}
                onChange={(e) => setSendChunkSize(Number(e.target.value))}
                style={{ marginBottom: "12px", padding: "6px", border: "1px solid #ccc", borderRadius: "6px" }}
            >
                {chunkOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>

            {fileSize > 0 && (
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                    File: {fileName} ({Math.round(fileSize / (1024 * 1024))} MB)
                </p>
            )}

            <div style={{ marginTop: "10px" }}>
                <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${sendProgress}%`, background: "#4caf50", transition: "width 0.2s" }} />
                </div>
                <p style={{ marginTop: "6px", fontSize: "14px" }}>
                    {status === "sending" && `Sending... ${sendProgress}%`}
                    {status === "completed" && `Ready to download`}
                </p>
            </div>

            {status === "assembling" && (
                <div style={{ marginTop: "10px" }}>
                    <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${assembleProgress}%`, background: "#ff9800", transition: "width 0.2s" }} />
                    </div>
                    <p style={{ marginTop: "6px", fontSize: "14px" }}>Assembling... {assembleProgress}%</p>
                </div>
            )}

            <button
                onClick={handleDownload}
                disabled={!fileId || status === "sending"}
                style={{
                    marginTop: "12px",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "6px",
                    background: fileId && status !== "sending" ? "#2196f3" : "#aaa",
                    color: "white",
                    cursor: fileId && status !== "sending" ? "pointer" : "not-allowed",
                }}
            >
                {fileId ? `Download (${fileName})` : "No File Yet"}
            </button>
        </div>
    );
};

export default FileSender;
