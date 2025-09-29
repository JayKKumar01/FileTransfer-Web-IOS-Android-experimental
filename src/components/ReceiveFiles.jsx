import React, { useContext } from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";

const ReceiveFiles = () => {
    const { downloads } = useContext(FileContext);

    if (!downloads.length) {
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
                    {downloads.map((download) => (
                        <li className="receive-file-item" key={download.id}>
                            {/* File name row */}
                            <div className="file-row file-name-row">
                                <span className="file-name">{download.metadata.name}</span>
                            </div>

                            {/* File progress row */}
                            <div className="file-row file-progress-row">
                                <span className="file-progress-text">
                                    {formatFileSize(download.status.progress || 0)} / {formatFileSize(download.metadata.size)}
                                </span>
                                <button
                                    className="download-button"
                                    disabled={download.status.state !== "completed"}
                                >
                                    ⬇
                                </button>
                            </div>

                            {/* Progress bar */}
                            <div className="file-row progress-bar-row">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${download.status.progress || 0}%` }}
                                    />
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
