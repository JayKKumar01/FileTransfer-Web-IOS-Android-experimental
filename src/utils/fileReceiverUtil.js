import { useContext } from "react";
import streamSaver from "streamsaver";
import { LogContext } from "../contexts/LogContext";
import { isApple } from "./osUtil";

// -------------------- iOS Buffers --------------------
const IOS_BUFFER_THRESHOLD = 2 * 1024 * 1024; // 2 MB
const iosBufferMap = {};
const iosOffsetMap = {};
const iosBlobPartsMap = {};

// -------------------- Non-iOS Buffers --------------------
const NON_IOS_BUFFER_THRESHOLD = 8 * 1024 * 1024; // 8 MB
const nonIosBufferMap = {};
const nonIosOffsetMap = {};
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
        let initialized = false;

        if (!iosBufferMap[fileId]) {
            iosBufferMap[fileId] = new Uint8Array(IOS_BUFFER_THRESHOLD);
            initialized = true;
        }
        if (!iosOffsetMap[fileId]) {
            iosOffsetMap[fileId] = 0;
            initialized = true;
        }
        if (!iosBlobPartsMap[fileId]) {
            iosBlobPartsMap[fileId] = [];
            initialized = true;
        }

        if (initialized) {
            log(`iOS Init: fileId=${fileId}`);
        }
    }


    async function iosPushChunk(fileId, chunk) {
        if (!chunk) return;
        let remaining = new Uint8Array(chunk);

        while (remaining.length > 0) {
            const offset = iosOffsetMap[fileId];
            const spaceLeft = IOS_BUFFER_THRESHOLD - offset;
            const toWrite = remaining.subarray(0, spaceLeft);
            iosBufferMap[fileId].set(toWrite, offset);
            iosOffsetMap[fileId] += toWrite.length;
            remaining = remaining.subarray(toWrite.length);

            if (iosOffsetMap[fileId] >= IOS_BUFFER_THRESHOLD) {
                await iosFlush(fileId);
            }
        }
        log(`iOS PushChunk: fileId=${fileId}, size=${chunk.byteLength}`);
    }

    async function iosFlush(fileId) {
        const offset = iosOffsetMap[fileId];
        if (!offset) return;

        const blob = new Blob([iosBufferMap[fileId].slice(0, offset)]);
        iosBlobPartsMap[fileId].push(blob);
        iosOffsetMap[fileId] = 0;
        log(`iOS Flush: fileId=${fileId}, parts=${iosBlobPartsMap[fileId].length}`);
    }

    async function iosFinalize(fileId, fileName, mimeType = "application/octet-stream") {
        await iosFlush(fileId);
        const finalBlob = new Blob(iosBlobPartsMap[fileId], { type: mimeType });

        // Cleanup
        delete iosBufferMap[fileId];
        delete iosOffsetMap[fileId];
        delete iosBlobPartsMap[fileId];

        return finalBlob;
    }

    // -------------------- Non-iOS Helpers --------------------
    function nonIosInit(fileId, fileName, mimeType = "application/octet-stream") {
        if (!writerMap[fileId]) {
            const fileStream = streamSaver.createWriteStream(fileName, { size: 0, mimeType });
            writerMap[fileId] = fileStream.getWriter();
            nonIosBufferMap[fileId] = new Uint8Array(NON_IOS_BUFFER_THRESHOLD);
            nonIosOffsetMap[fileId] = 0;
            log(`Non-iOS Init: fileId=${fileId}, fileName=${fileName}`);
        }
    }

    async function nonIosPushChunk(fileId, chunk) {
        if (!chunk) return;
        const buffer = nonIosBufferMap[fileId];
        let offset = nonIosOffsetMap[fileId];
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

        nonIosOffsetMap[fileId] = offset;
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

        const offset = nonIosOffsetMap[fileId];
        if (offset > 0) await nonIosFlush(fileId, nonIosBufferMap[fileId], offset);

        await writer.close();

        // Cleanup
        delete writerMap[fileId];
        delete nonIosBufferMap[fileId];
        delete nonIosOffsetMap[fileId];

        log(`Non-iOS Finalize: fileId=${fileId}`);
    }

    // -------------------- Public API --------------------
    return {
        initFile(fileId, fileName, mimeType = "application/octet-stream") {
            return isApple() ? iosInit(fileId) : nonIosInit(fileId, fileName, mimeType);
        },
        pushChunk(fileId, chunk) {
            return isApple() ? iosPushChunk(fileId, chunk) : nonIosPushChunk(fileId, chunk);
        },
        finalizeFile(fileId, fileName, mimeType = "application/octet-stream") {
            return isApple() ? iosFinalize(fileId, fileName, mimeType) : nonIosFinalize(fileId);
        },
    };
}
