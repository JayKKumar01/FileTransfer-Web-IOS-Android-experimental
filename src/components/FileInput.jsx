import React, { useContext, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/FileInput.css";
import { FileContext } from "../contexts/FileContext";

// -------------------- File Item Component --------------------
const FileItem = memo(({ file, onRemove }) => {
    const [removing, setRemoving] = useState(false);

    const handleRemove = () => {
        setRemoving(true);
        setTimeout(() => onRemove(file.id), 300);
    };

    return (
        <li className={`FileItem ${removing ? "removing" : ""}`}>
            <span className="FileNameText">{file.metadata.name}</span>
            <button className="RemoveFileButton" onClick={handleRemove}>
                ×
            </button>
        </li>
    );
});

// -------------------- File Input Component --------------------
const FileInput = () => {
    const { addFiles, files } = useContext(FileContext);
    const [tempFiles, setTempFiles] = useState([]);
    const navigate = useNavigate();

    // Handle file selection
    const handleFilesChange = (event) => {
        const selectedFiles = Array.from(event.target.files);
        setTempFiles(selectedFiles);
        event.target.value = null; // reset input
    };

    // Remove a file from tempFiles
    const removeFile = (fileToRemove) => {
        setTempFiles((prev) => prev.filter((f) => f !== fileToRemove));
    };

    // Move files from temp to main context using addFiles helper
    const handleShare = () => {
        if (tempFiles.length === 0) return;
        addFiles(tempFiles); // FileContext handles full FileItem creation
        setTempFiles([]);
        navigate("/send");
    };

    // View current files in progress
    const handleViewFiles = () => {
        navigate("/send");
    };

    return (
        <div className="FileInput">
            {files.length > 0 && (
                <div className="TopRow">
          <span className="SecondaryLink" onClick={handleViewFiles}>
            View Current Progress
          </span>
                </div>
            )}

            <input type="file" multiple onChange={handleFilesChange} />
            <p className="FileCount">
                {tempFiles.length > 0
                    ? `${tempFiles.length} file(s) selected`
                    : "No files selected"}
            </p>

            {tempFiles.length > 0 && (
                <div className="FileList">
                    <ul>
                        {tempFiles.map((file) => (
                            <FileItem
                                key={file.name + file.size + file.lastModified} // unique key
                                file={{
                                    id: file.name + file.lastModified, // temp id only for rendering
                                    metadata: { name: file.name },
                                }}
                                onRemove={() => removeFile(file)}
                            />
                        ))}
                    </ul>
                </div>
            )}

            {tempFiles.length > 0 && (
                <button className="ShareFilesButton" onClick={handleShare}>
                    Proceed to Send
                </button>
            )}
        </div>
    );
};

export default FileInput;
