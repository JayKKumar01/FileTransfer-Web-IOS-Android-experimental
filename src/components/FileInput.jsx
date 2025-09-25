import React, { useContext, memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/FileInput.css";
import { FileContext } from "../contexts/FileContext";

const FileItem = memo(({ file, onRemove }) => (
    <li>
        {file.name}
        <button className="RemoveFileButton" onClick={onRemove}>×</button>
    </li>
));

const FileInput = () => {
    const { files, setFiles } = useContext(FileContext);
    const navigate = useNavigate();

    const handleFilesChange = (event) => {
        const newFiles = Array.from(event.target.files);
        setFiles(newFiles); // replace previous files
        event.target.value = null;
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleShare = () => {
        if (files.length === 0) return;
        navigate("/share");
    };

    return (
        <div className="FileInput">
            <h2>Select files to upload</h2>
            <input type="file" multiple onChange={handleFilesChange} />
            <p className="FileCount">
                {files.length > 0 ? `${files.length} file(s) selected` : "No files selected"}
            </p>

            {files.length > 0 && (
                <div className="FileList">
                    <ul>
                        {files.map((file, idx) => (
                            <FileItem
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                file={file}
                                onRemove={() => removeFile(idx)}
                            />
                        ))}
                    </ul>
                </div>
            )}

            {files.length > 0 && (
                <button className="ShareFilesButton" onClick={handleShare}>
                    Share Files
                </button>
            )}
        </div>
    );
};

export default FileInput;
