import React, { useContext, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/FileInput.css";
import { FileContext } from "../contexts/FileContext";

const FileItem = memo(({ file, onRemove }) => {
    const [removing, setRemoving] = useState(false);

    const handleRemove = () => {
        setRemoving(true);
        setTimeout(() => onRemove(file.id), 300);
    };

    return (
        <li className={`FileItem ${removing ? "removing" : ""}`}>
            <span className="FileNameText">{file.name}</span>
            <button className="RemoveFileButton" onClick={handleRemove}>×</button>
        </li>
    );
});

const FileInput = () => {
    const { files, setFiles } = useContext(FileContext);
    const [tempFiles, setTempFiles] = useState([]);
    const navigate = useNavigate();

    const handleFilesChange = (event) => {
        const newFiles = Array.from(event.target.files).map((file) => ({
            id: `${file.name}-${file.size}-${Date.now()}`, // unique id
            file,
            name: file.name,
        }));
        setTempFiles(newFiles);
        event.target.value = null;
    };

    const removeFile = (id) => {
        setTempFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleShare = () => {
        if (tempFiles.length === 0) return;
        setFiles((prevFiles) => [...prevFiles, ...tempFiles]);
        setTempFiles([]);
        navigate("/send");
    };

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
                {tempFiles.length > 0 ? `${tempFiles.length} file(s) selected` : "No files selected"}
            </p>

            {tempFiles.length > 0 && (
                <div className="FileList">
                    <ul>
                        {tempFiles.map((file) => (
                            <FileItem
                                key={file.id}
                                file={file}
                                onRemove={removeFile}
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
