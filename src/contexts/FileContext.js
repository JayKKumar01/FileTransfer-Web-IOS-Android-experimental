import React, { createContext, useState, useEffect, useContext } from "react";
import { usePeer } from "./PeerContext"; // Your PeerContext
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

    // -------------------- Send Metadata Effect --------------------
    useEffect(() => {
        if (!connection || !isConnectionReady) return;

        const unsentFiles = files.filter((f) => !f.metaSent);
        if (unsentFiles.length === 0) return;

        unsentFiles.forEach((file) => {
            try {
                connection.send({
                    type: "metadata",
                    payload: {
                        id: file.id,
                        metadata: file.metadata,
                    },
                });
                updateFile(file.id, { metaSent: true });

                // ✅ Success log
                console.log(
                    `Metadata sent successfully for file: "${file.metadata.name}" | ID: ${file.id} | Size: ${file.metadata.size} | Type: ${file.metadata.type}`
                );
            } catch (err) {
                console.error(`Failed to send metadata for file ${file.id}:`, err);
            }
        });
    }, [files, connection, isConnectionReady]);


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
