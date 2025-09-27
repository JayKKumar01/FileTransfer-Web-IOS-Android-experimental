import React, { useState, useRef, useContext } from "react";
import { LogContext } from "../contexts/LogContext";
import { setItem, getItem, removeItem, clearStore } from "../utils/dbUtil";

const useLogger = () => {
    const { pushLog } = useContext(LogContext);
    return (msg) => {
        console.log(msg);
        pushLog(msg);
    };
};

const FileSender = () => {
    const [sendProgress, setSendProgress] = useState(0);
    const [assembleProgress, setAssembleProgress] = useState(0);
    const [status, setStatus] = useState("idle");
    const [fileId, setFileId] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [chunkCount, setChunkCount] = useState(0);
    const [fileSize, setFileSize] = useState(0);

    const metadataRef = useRef({});
    const log = useLogger();
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const readSliceAsArrayBuffer = (blobSlice) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blobSlice);
        });

    const sendChunk = async (fileId, index, chunkBlob) => {
        const arrayBuffer = await readSliceAsArrayBuffer(chunkBlob);
        await setItem(`${fileId}-${index}`, arrayBuffer);
        log(`Chunk stored → fileId: ${fileId}, index: ${index}, size: ${arrayBuffer.byteLength} bytes`);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const chunkSize = 512 * 1024; // 512KB
        let offset = 0,
            index = 0;
        const newFileId = Date.now().toString();

        setStatus("sending");
        setFileId(newFileId);
        setFileName(file.name);
        setFileSize(file.size);

        metadataRef.current[newFileId] = {
            name: file.name,
            totalChunks: 0,
            type: file.type,
            totalSize: file.size,
        };

        try {
            while (offset < file.size) {
                const slice = file.slice(offset, offset + chunkSize);
                await sendChunk(newFileId, index, slice);

                offset += chunkSize;
                index++;
                metadataRef.current[newFileId].totalChunks = index;

                setSendProgress(Math.min(100, Math.round((offset / file.size) * 100)));
                setChunkCount(index);
            }
            setStatus("completed");
            log(`✅ File saved → fileId: ${newFileId}, chunks: ${index}, size: ${file.size} bytes`);
        } catch (err) {
            log(`❌ Error saving file: ${err.message}`);
            setStatus("error");
        }
    };

    const handleDownload = async () => {
        if (!fileId) return alert("No file available");

        const metadata = metadataRef.current[fileId];
        if (!metadata) return alert("No metadata found");

        setAssembleProgress(0);
        setStatus("assembling");

        try {
            const chunks = [];

            for (let i = 0; i < metadata.totalChunks; i++) {
                const data = await getItem(`${fileId}-${i}`);
                if (data) chunks.push(isIos ? new Blob([data]) : data);
                else log(`⚠️ Missing chunk ${i}`);

                setAssembleProgress(Math.min(100, Math.round(((i + 1) / metadata.totalChunks) * 100)));

                if (i % 5 === 0) await new Promise((res) => setTimeout(res, 0));
                await removeItem(`${fileId}-${i}`).catch(() => {});
            }

            const assembledBlob = new Blob(chunks, { type: metadata.type || "application/octet-stream" });
            const url = URL.createObjectURL(assembledBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = metadata.name || "downloaded_file";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            log(`⬇️ Downloaded: ${metadata.name}, size: ${assembledBlob.size}`);

            await clearStore(); // clear DB after download

            delete metadataRef.current[fileId];
            setFileId(null);
            setFileName(null);
            setFileSize(0);
            setSendProgress(0);
            setAssembleProgress(0);
            setStatus("idle");
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
            {fileSize > 0 && (
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                    File: {fileName} ({Math.round(fileSize / (1024 * 1024))} MB){isIos && " [iOS ArrayBuffer → Blob]"}
                </p>
            )}

            <div style={{ marginTop: "10px" }}>
                <div style={{ height: "20px", width: "100%", background: "#eee", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${sendProgress}%`, background: "#4caf50", transition: "width 0.2s" }} />
                </div>
                <p style={{ marginTop: "6px", fontSize: "14px" }}>
                    {status === "sending" && `Sending... ${sendProgress}% (${chunkCount} chunks)`}
                    {status === "completed" && `Ready to download - ${chunkCount} chunks`}
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
