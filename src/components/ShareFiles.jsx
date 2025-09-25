import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ShareFiles.css";
import { FileContext } from "../contexts/FileContext";

const ShareFiles = () => {
    const { files } = useContext(FileContext);
    const navigate = useNavigate();

    return (
        <div className="FileShareContainer">
            <h2 className="FileShareTitle">Share Files</h2>

            {files.length === 0 ? (
                <p className="NoFilesText">No files selected.</p>
            ) : (
                <div className="FileShareList">
                    <ul>
                        {files.map((file, idx) => (
                            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="FileShareItem">

                                {/* Row 1: File name */}
                                <div className="FileRow FileNameRow">
                                    <span className="FileName">{file.name}</span>
                                </div>

                                {/* Row 2: Progressed / total size and Download button */}
                                <div className="FileRow FileProgressRow">
                                    <span className="FileProgressText">
                                        0 KB / {Math.round(file.size / 1024)} KB
                                    </span>
                                    <button className="DownloadFileButton" disabled>
                                        ⬇
                                    </button>
                                </div>

                                {/* Row 3: Progress bar */}
                                <div className="FileRow ProgressBarRow">
                                    <div className="ProgressBar">
                                        <div className="ProgressFill" style={{ width: "0%" }}></div>
                                    </div>
                                </div>

                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <button className="FileShareBackButton" onClick={() => navigate("/files")}>
                Back to File Selection
            </button>
        </div>
    );
};

export default ShareFiles;
