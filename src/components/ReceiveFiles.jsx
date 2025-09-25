import React, { useContext } from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";

const ReceiveFiles = () => {
    const { downloads } = useContext(FileContext);

    if (downloads.length === 0) {
        return (
            <div className="receive-files-container">
                <p className="no-files-text">No files received yet.</p>
            </div>
        );
    }

    return (
        <div className="receive-files-container">
            <div className="receive-files-list">
                <ul>
                    {downloads.map((file, index) => (
                        <li className="receive-file-item" key={index}>
                            <div className="file-row file-name-row">
                                <span className="file-name">{file.name}</span>
                            </div>
                            <div className="file-row file-progress-row">
                                <span className="file-progress-text">
                                    0 KB / {formatFileSize(file.size)}
                                </span>
                                <button className="download-button" disabled>
                                    ⬇
                                </button>
                            </div>
                            <div className="file-row progress-bar-row">
                                <div className="progress-bar">
                                    <div className="progress-fill" />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ReceiveFiles;
