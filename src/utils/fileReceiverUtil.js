import { useContext } from "react";
import streamSaver from "streamsaver";
import { LogContext } from "../contexts/LogContext";
import { isApple } from "./osUtil";

// -------------------- Config --------------------
const IOS_BUFFER_THRESHOLD = 2 * 1024 * 1024;    // 2 MB
const NON_IOS_BUFFER_THRESHOLD = 8 * 1024 * 1024; // 8 MB

// -------------------- Shared Buffers --------------------
const bufferMap = {};
const offsetMap = {};

// -------------------- Platform-specific --------------------
const iosBlobPartsMap = {};
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
        if (!iosBlobPartsMap[fileId]) {
            iosBlobPartsMap[fileId] = [];
            bufferMap[fileId] = new Uint8Array(IOS_BUFFER_THRESHOLD);
            offsetMap[fileId] = 0;

            log(`iOS Init: fileId=${fileId}`);
        }
    }



    async function iosPushChunk(fileId, chunk) {
        if (!chunk) return;
        let remaining = new Uint8Array(chunk);

        while (remaining.length > 0) {
            const offset = offsetMap[fileId];
            const spaceLeft = IOS_BUFFER_THRESHOLD - offset;
            const toWrite = remaining.subarray(0, spaceLeft);
            bufferMap[fileId].set(toWrite, offset);
            offsetMap[fileId] += toWrite.length;
            remaining = remaining.subarray(toWrite.length);

            if (offsetMap[fileId] >= IOS_BUFFER_THRESHOLD) {
                await iosFlush(fileId);
            }
        }
        log(`iOS PushChunk: fileId=${fileId}, size=${chunk.byteLength}`);
    }

    async function iosFlush(fileId) {
        const offset = offsetMap[fileId];
        if (!offset) return;

        const blob = new Blob([bufferMap[fileId].slice(0, offset)]);
        iosBlobPartsMap[fileId].push(blob);
        offsetMap[fileId] = 0;
        log(`iOS Flush: fileId=${fileId}, parts=${iosBlobPartsMap[fileId].length}`);
    }

    async function iosFinalize(fileId, fileName, mimeType = "application/octet-stream") {
        await iosFlush(fileId);
        const finalBlob = new Blob(iosBlobPartsMap[fileId], { type: mimeType });

        // Cleanup
        delete bufferMap[fileId];
        delete offsetMap[fileId];
        delete iosBlobPartsMap[fileId];

        return finalBlob;
    }

    // -------------------- Non-iOS Helpers --------------------
    function nonIosInit(fileId, fileName, fileSize, mimeType = "application/octet-stream") {
        if (!writerMap[fileId]) {
            const fileStream = streamSaver.createWriteStream(fileName, { size: fileSize, mimeType });
            writerMap[fileId] = fileStream.getWriter();
            bufferMap[fileId] = new Uint8Array(NON_IOS_BUFFER_THRESHOLD);
            offsetMap[fileId] = 0;
            log(`Non-iOS Init: fileId=${fileId}, fileName=${fileName}`);
        }
    }

    async function nonIosPushChunk(fileId, chunk) {
        if (!chunk) return;
        const buffer = bufferMap[fileId];
        let offset = offsetMap[fileId];
        let remaining = new Uint8Array(chunk);

        while (remaining.length > 0) {
            const spaceLeft = NON_IOS_BUFFER_THRESHOLD - offset;
            const toWrite = remaining.subarray(0, spaceLeft);
            buffer.set(toWrite, offset);
            offset += toWrite.length;
            remaining = remaining.subarray(toWrite.length);

            if (offset >= NON_IOS_BUFFER_THRESHOLD) {
                await nonIosFlush(fileId, buffer, offset);
                offset = 0;
            }
        }

        offsetMap[fileId] = offset;
        log(`Non-iOS PushChunk: fileId=${fileId}, size=${chunk.byteLength}`);
    }

    async function nonIosFlush(fileId, buffer, offset) {
        const writer = writerMap[fileId];
        if (!writer || offset === 0) return;

        await writer.write(buffer.subarray(0, offset));
        log(`Non-iOS Flush: fileId=${fileId}, flushed=${offset} bytes`);
    }

    async function nonIosFinalize(fileId) {
        const writer = writerMap[fileId];
        if (!writer) return;

        const offset = offsetMap[fileId];
        if (offset > 0) await nonIosFlush(fileId, bufferMap[fileId], offset);

        await writer.close();

        // Cleanup
        delete writerMap[fileId];
        delete bufferMap[fileId];
        delete offsetMap[fileId];

        log(`Non-iOS Finalize: fileId=${fileId}`);
    }

    // -------------------- Public API --------------------
    return {
        initFile(fileId, fileName, fileSize, mimeType = "application/octet-stream") {
            return isApple() ? iosInit(fileId) : nonIosInit(fileId, fileName, fileSize, mimeType);
        },
        pushChunk(fileId, chunk) {
            return isApple() ? iosPushChunk(fileId, chunk) : nonIosPushChunk(fileId, chunk);
        },
        finalizeFile(fileId, fileName, mimeType = "application/octet-stream") {
            return isApple() ? iosFinalize(fileId, fileName, mimeType) : nonIosFinalize(fileId);
        },
    };
}
