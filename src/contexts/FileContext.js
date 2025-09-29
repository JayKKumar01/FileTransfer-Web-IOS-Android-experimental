import React, { createContext, useState, useEffect, useContext } from "react";
import { usePeer } from "./PeerContext";
import {useFileMetadata} from "../hooks/useFileMetadata"; // Your PeerContext
/**
 * @typedef {import('../interfaces/file').FileItem} FileItem
 */

export const FileContext = createContext({
    files: /** @type {FileItem[]} */ ([]),
    addFiles: /** @type {(newFiles: File[]) => void} */ (() => {}),
    updateFile: /** @type {(id: string, updates: Partial<FileItem["status"] & { metaSent?: boolean }>) => void} */ (() => {}),
    removeFile: /** @type {(id: string) => void} */ (() => {}),
    downloads: [],
    setDownloads: () => {},
});

export const FileProvider = ({ children }) => {
    const { connection, isConnectionReady } = usePeer();
    const [files, setFiles] = useState([]); // files to send
    const [downloads, setDownloads] = useState([]); // files being received

    // Helper to generate unique 8-char ID
    const generateUniqueId = () => {
        let id;
        do {
            id = Math.random().toString(36).substring(2, 10);
        } while (files.some((f) => f.id === id));
        return id;
    };

    // Add new files
    const addFiles = (newFiles) => {
        const items = newFiles.map((file) => ({
            id: generateUniqueId(),
            file,
            metadata: {
                name: file.name,
                size: file.size,
                type: file.type,
            },
            metaSent: false,
            status: {
                state: "pending",
                progress: 0,
            },
        }));
        setFiles((prev) => [...prev, ...items]);
    };

    // Update file status or metaSent by id
    const updateFile = (id, updates) => {
        setFiles((prev) =>
            prev.map((file) =>
                file.id === id
                    ? {
                        ...file,
                        status: { ...file.status, ...updates },
                        metaSent: updates.metaSent ?? file.metaSent,
                    }
                    : file
            )
        );
    };

    // Remove file by id
    const removeFile = (id) => {
        setFiles((prev) => prev.filter((file) => file.id !== id));
    };

    // Use the metadata hook
    useFileMetadata(files, updateFile);

    return (
        <FileContext.Provider
            value={{
                files,
                addFiles,
                updateFile,
                removeFile,
                downloads,
                setDownloads,
            }}
        >
            {children}
        </FileContext.Provider>
    );
};
