import React, { createContext, useState } from "react";

export const FileContext = createContext({
    files: [],
    setFiles: () => {},
    downloads: [],
    setDownloads: () => {},
});

export const FileProvider = ({ children }) => {
    const [files, setFiles] = useState([]);       // files to send
    const [downloads, setDownloads] = useState([]); // files being received

    return (
        <FileContext.Provider value={{ files, setFiles, downloads, setDownloads }}>
            {children}
        </FileContext.Provider>
    );
};
