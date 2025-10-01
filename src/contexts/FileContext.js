import React, { createContext, useState } from "react";
import { useFileMetadata } from "../hooks/useFileMetadata";
import {useFileSender} from "../hooks/useFileSender";
import {useFileReceiver} from "../hooks/useFileReceiver";

/**
 * @typedef {import('../interfaces/file').FileItem} FileItem
 * @typedef {import('../interfaces/download').DownloadItem} DownloadItem
 */

export const FileContext = createContext({
    files: /** @type {FileItem[]} */ ([]),
    addFiles: /** @type {(newFiles: File[]) => void} */ (() => {}),
    updateFile: /** @type {(id: string, updates: Partial<FileItem["status"] & { metaSent?: boolean }>) => void} */ (() => {}),
    removeFile: /** @type {(id: string) => void} */ (() => {}),
    downloads: /** @type {DownloadItem[]} */ ([]),
    addDownloads: /** @type {(downloads: DownloadItem[]) => void} */ (() => {}),
    updateDownload: /** @type {(id: string, updates: Partial<DownloadItem["status"]>) => void} */ (() => {}),
    removeDownload: /** @type {(id: string) => void} */ (() => {}),
});

export const FileProvider = ({ children }) => {
    const [files, setFiles] = useState([]);
    const [downloads, setDownloads] = useState([]);

    const generateUniqueId = () => {
        let id;
        do {
            id = Math.random().toString(36).substring(2, 10);
        } while (files.some(f => f.id === id) || downloads.some(d => d.id === id));
        return id;
    };

    // -------------------- File Operations --------------------
    const addFiles = (newFiles) => {
        const items = newFiles.map(file => ({
            id: generateUniqueId(),
            file,
            metadata: { name: file.name, size: file.size, type: file.type },
            metaSent: false,
            status: { state: "pending", progress: 0 },
        }));
        setFiles(prev => [...prev, ...items]);
    };

    const updateFile = (id, updates) => {
        setFiles(prev =>
            prev.map(file =>
                file.id === id
                    ? { ...file, status: { ...file.status, ...updates }, metaSent: updates.metaSent ?? file.metaSent }
                    : file
            )
        );
    };

    const removeFile = (id) => setFiles(prev => prev.filter(file => file.id !== id));

    // -------------------- Download Operations --------------------
    const addDownloads = (newDownloads) => {
        setDownloads(prev => [...prev, ...newDownloads]);
    };

    const updateDownload = (id, updates) =>
        setDownloads(prev =>
            prev.map(d => (d.id === id ? { ...d, status: { ...d.status, ...updates } } : d))
        );

    const removeDownload = (id) =>
        setDownloads((prev) =>
            prev
                .map((d) => {
                    if (d.id === id && d.status.blob) {
                        // clear the blob reference
                        d.status.blob = null;
                    }
                    return d;
                })
                .filter((d) => d.id !== id)
        );


    // -------------------- Metadata Hook --------------------
    useFileMetadata(files, updateFile, addDownloads);
    useFileSender(files, updateFile);                 // send file chunks
    useFileReceiver(downloads, updateDownload);

    return (
        <FileContext.Provider
            value={{
                files,
                addFiles,
                updateFile,
                removeFile,
                downloads,
                addDownloads,
                updateDownload,
                removeDownload,
            }}
        >
            {children}
        </FileContext.Provider>
    );
};
