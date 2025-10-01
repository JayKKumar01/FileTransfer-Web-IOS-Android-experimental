import { useContext } from "react";
import streamSaver from "streamsaver";
import { LogContext } from "../contexts/LogContext";

// -------------------- Platform Detection --------------------
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

// -------------------- iOS Buffers --------------------
const BUFFER_THRESHOLD = 2 * 1024 * 1024; // 2 MB
const bufferMap = {};
const bufferOffsetMap = {};
const blobPartsMap = {};

// -------------------- Non-iOS Writers --------------------
const writerMap = {};

// -------------------- Hook Wrapper --------------------
export function useFileTransfer() {
    const { pushLog } = useContext(LogContext);

    const log = (msg) => {
        console.log(msg);
        pushLog?.(msg);
    };

    // -------------------- iOS Helpers --------------------
    async function iosInit(fileId) {
        if (!bufferMap[fileId]) bufferMap[fileId] = new Uint8Array(BUFFER_THRESHOLD);
        if (!bufferOffsetMap[fileId]) bufferOffsetMap[fileId] = 0;
        if (!blobPartsMap[fileId]) blobPartsMap[fileId] = [];
        log(`iOS Init: fileId=${fileId}`);
    }

    async function iosPushChunk(fileId, chunk) {
        if (!chunk) return;
        let remaining = new Uint8Array(chunk);

        while (remaining.length > 0) {
            const offset = bufferOffsetMap[fileId];
            const spaceLeft = BUFFER_THRESHOLD - offset;

            const toWrite = remaining.subarray(0, spaceLeft);
            bufferMap[fileId].set(toWrite, offset);
            bufferOffsetMap[fileId] += toWrite.length;

            remaining = remaining.subarray(toWrite.length);

            if (bufferOffsetMap[fileId] >= BUFFER_THRESHOLD) {
                await iosFlush(fileId);
            }
        }
        log(`iOS PushChunk: fileId=${fileId}, size=${chunk.byteLength}`);
    }

    async function iosFlush(fileId) {
        const offset = bufferOffsetMap[fileId];
        if (!offset) return;

        const blob = new Blob([bufferMap[fileId].slice(0, offset)]);
        blobPartsMap[fileId].push(blob);
        bufferOffsetMap[fileId] = 0;
        log(`iOS Flush: fileId=${fileId}, parts=${blobPartsMap[fileId].length}`);
    }

    // -------------------- Inline Worker --------------------
    let blobWorker;
    function ensureBlobWorker() {
        if (!blobWorker) {
            const workerCode = `
        self.onmessage = async (e) => {
          const { type, fileId, fileName, mimeType, parts } = e.data;
          if (type === 'finalize') {
            const totalParts = parts.length;
            const kept = [];

            for (let i = 0; i < totalParts; i++) {
              kept.push(parts[i]);
              self.postMessage({
                type: 'progress',
                phase: 'finalizing',
                fileId,
                done: i + 1,
                total: totalParts,
                percent: Math.round(((i + 1) / totalParts) * 100)
              });
              await new Promise(r => setTimeout(r, 0));
            }

            const finalBlob = new Blob(kept, { type: mimeType });
            self.postMessage({ type: 'done', fileId, fileName, blob: finalBlob });
          }
        };
      `;
            const blob = new Blob([workerCode], { type: "application/javascript" });
            const workerUrl = URL.createObjectURL(blob);
            blobWorker = new Worker(workerUrl);
        }
    }

    async function iosFinalize(fileId, fileName, mimeType = "application/octet-stream") {
        await iosFlush(fileId);
        ensureBlobWorker();
        const parts = blobPartsMap[fileId];
        log(`iOS Finalize requested: fileId=${fileId}, parts=${parts.length}`);

        return new Promise((resolve) => {
            const handleMessage = (e) => {
                const data = e.data;
                if (data.fileId !== fileId) return;

                if (data.type === "progress") {
                    log(`Finalizing ${data.fileId}: ${data.percent}% (${data.done}/${data.total})`);
                } else if (data.type === "done") {
                    blobWorker.removeEventListener("message", handleMessage);
                    log(`iOS Finalize completed: ${data.fileName}`);
                    resolve(data.blob); // return the final Blob
                }
            };

            blobWorker.addEventListener("message", handleMessage);

            blobWorker.postMessage({ type: "finalize", fileId, fileName, mimeType, parts });

            // Cleanup maps immediately
            delete bufferMap[fileId];
            delete bufferOffsetMap[fileId];
            delete blobPartsMap[fileId];
        });
    }

    // -------------------- Non-iOS Helpers --------------------
    function nonIosInit(fileId, fileName, mimeType = "application/octet-stream") {
        if (!writerMap[fileId]) {
            const fileStream = streamSaver.createWriteStream(fileName, { size: 0, mimeType });
            writerMap[fileId] = fileStream.getWriter();
            log(`Non-iOS Init: fileId=${fileId}, fileName=${fileName}`);
        }
    }

    async function nonIosPushChunk(fileId, chunk) {
        const writer = writerMap[fileId];
        if (writer && chunk) {
            await writer.write(new Uint8Array(chunk));
            log(`Non-iOS PushChunk: fileId=${fileId}, size=${chunk.byteLength}`);
        }
    }

    async function nonIosFinalize(fileId) {
        const writer = writerMap[fileId];
        if (writer) {
            await writer.close();
            delete writerMap[fileId];
            log(`Non-iOS Finalize: fileId=${fileId}`);
        }
    }

    // -------------------- Public API --------------------
    return {
        initFile(fileId, fileName, mimeType = "application/octet-stream") {
            return isIOS ? iosInit(fileId) : nonIosInit(fileId, fileName, mimeType);
        },
        pushChunk(fileId, chunk) {
            return isIOS ? iosPushChunk(fileId, chunk) : nonIosPushChunk(fileId, chunk);
        },
        flushBuffer(fileId) {
            return isIOS ? iosFlush(fileId) : Promise.resolve();
        },
        finalizeFile(fileId, fileName, mimeType = "application/octet-stream") {
            return isIOS ? iosFinalize(fileId, fileName, mimeType) : nonIosFinalize(fileId);
        },
    };
}
