import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ShareFiles.css";
import { FileContext } from "../contexts/FileContext";

const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

const ShareFiles = ({ isSender }) => {
    const { files, downloads } = useContext(FileContext);
    const navigate = useNavigate();

    const fileList = isSender ? files : downloads;

    if (!isSender && fileList.length === 0) {
        return (
            <div className="FileShareContainer">
                <p className="NoFilesText">No files received yet.</p>
            </div>
        );
    }

    return (
        <div className="FileShareContainer">
            <div className="FileShareList">
                <ul>
                    {fileList.map((file, index) => (
                        <li className="FileShareItem" key={index}>
                            <div className="FileRow FileNameRow">
                                <span className="FileName">{file.name}</span>
                            </div>

                            <div className="FileRow FileProgressRow">
                                <span className="FileProgressText">
                                    0 KB / {formatFileSize(file.size)}
                                </span>
                                {!isSender && (
                                    <button className="DownloadFileButton" disabled>
                                        ⬇
                                    </button>
                                )}
                            </div>

                            <div className="FileRow ProgressBarRow">
                                <div className="ProgressBar">
                                    <div className="ProgressFill" style={{ width: "0%" }} />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {isSender && (
                <button
                    className="FileShareBackButton"
                    onClick={() => navigate("/files")}
                >
                    Return to File Selection
                </button>
            )}
        </div>
    );
};

export default ShareFiles;
