import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/FileInput.css";
import { FileContext } from "../contexts/FileContext";

const ShareFiles = () => {
    const { files } = useContext(FileContext);
    const navigate = useNavigate();

    return (
        <div className="FileInput">
            <h2>Share Files</h2>
            {files.length === 0 ? (
                <p>No files selected.</p>
            ) : (
                <div className="FileList">
                    <h3>Files to Share:</h3>
                    <ul>
                        {files.map((file, idx) => (
                            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                                {file.name} ({Math.round(file.size / 1024)} KB)
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <button className="ShareFilesButton" onClick={() => navigate("/files")}>
                Back to File Selection
            </button>
        </div>
    );
};

export default ShareFiles;
