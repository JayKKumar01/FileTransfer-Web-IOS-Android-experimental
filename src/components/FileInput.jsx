import React, { useContext, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/FileInput.css";
import { FileContext } from "../contexts/FileContext";

const FileItem = memo(({ file, onRemove }) => (
    <li className="FileItem">
        <span className="FileNameText">{file.name}</span>
        <button className="RemoveFileButton" onClick={onRemove}>×</button>
    </li>
));

const FileInput = () => {
    const { setFiles } = useContext(FileContext); // don't read directly
    const [tempFiles, setTempFiles] = useState([]); // temporary list
    const navigate = useNavigate();

    const handleFilesChange = (event) => {
        const newFiles = Array.from(event.target.files);
        setTempFiles((prev) => [...prev, ...newFiles]);
        event.target.value = null; // allow same file re-selection
    };

    const removeFile = (index) => {
        const listItems = document.querySelectorAll(".FileList li");
        const item = listItems[index];
        if (item) {
            item.classList.add("removing");
            setTimeout(() => {
                setTempFiles((prev) => prev.filter((_, i) => i !== index));
            }, 300); // match transition duration
        }
    };

    const handleShare = () => {
        if (tempFiles.length === 0) return;

        // update the FileContext with the final temp list
        setFiles(tempFiles);

        // clear temp list
        setTempFiles([]);

        // navigate to share page
        navigate("/share");
    };

    return (
        <div className="FileInput">
            <input type="file" multiple onChange={handleFilesChange} />
            <p className="FileCount">
                {tempFiles.length > 0 ? `${tempFiles.length} file(s) selected` : "No files selected"}
            </p>

            {tempFiles.length > 0 && (
                <div className="FileList">
                    <ul>
                        {tempFiles.map((file, idx) => (
                            <FileItem
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                file={file}
                                onRemove={() => removeFile(idx)}
                            />
                        ))}
                    </ul>
                </div>
            )}

            {tempFiles.length > 0 && (
                <button className="ShareFilesButton" onClick={handleShare}>
                    Share Files
                </button>
            )}
        </div>
    );
};

export default FileInput;
