import { useContext } from "react";
import streamSaver from "streamsaver";
import { LogContext } from "../contexts/LogContext";
import {isApple} from "./osUtil";

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

    async function iosFinalize(fileId, fileName, mimeType = "application/octet-stream") {
        await iosFlush(fileId);

        const finalBlob = new Blob(blobPartsMap[fileId], { type: mimeType });

        // Cleanup maps immediately
        delete bufferMap[fileId];
        delete bufferOffsetMap[fileId];
        delete blobPartsMap[fileId];

        return finalBlob;
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
            return isApple() ? iosInit(fileId) : nonIosInit(fileId, fileName, mimeType);
        },
        pushChunk(fileId, chunk) {
            return isApple() ? iosPushChunk(fileId, chunk) : nonIosPushChunk(fileId, chunk);
        },
        flushBuffer(fileId) {
            return isApple() ? iosFlush(fileId) : Promise.resolve();
        },
        finalizeFile(fileId, fileName, mimeType = "application/octet-stream") {
            return isApple() ? iosFinalize(fileId, fileName, mimeType) : nonIosFinalize(fileId);
        },
    };
}
