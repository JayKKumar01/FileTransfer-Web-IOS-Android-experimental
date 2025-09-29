import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SendFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";

const SendFiles = () => {
    const { files } = useContext(FileContext);
    const navigate = useNavigate();

    return (
        <div className="send-files-container">
            {files.length === 0 ? (
                <p className="no-files-text">No files to send.</p>
            ) : (
                <div className="send-files-list">
                    <ul>
                        {files.map((file) => {
                            const progressPercent = Math.min(
                                (file.status.progress / file.metadata.size) * 100,
                                100
                            ).toFixed(2);

                            return (
                                <li className="send-file-item" key={file.id}>
                                    {/* File name row */}
                                    <div className="file-row file-name-row">
                                        <span className="file-name">{file.metadata.name}</span>
                                    </div>

                                    {/* Progress row */}
                                    <div className="file-row file-progress-row">
                    <span className="file-progress-text">
                      {formatFileSize(file.status.progress)} / {formatFileSize(file.metadata.size)}
                    </span>
                                        <span className="file-status">{file.status.state}</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="file-row progress-bar-row">
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <span className="back-button" onClick={() => navigate("/files")}>
        Return to File Selection
      </span>
        </div>
    );
};

export default SendFiles;
