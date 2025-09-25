import React, { createContext, useState } from "react";

export const FileContext = createContext({
    files: [],
    setFiles: () => {},
});

export const FileProvider = ({ children }) => {
    const [files, setFiles] = useState([]);
    return (
        <FileContext.Provider value={{ files, setFiles }}>
            {children}
        </FileContext.Provider>
    );
};
