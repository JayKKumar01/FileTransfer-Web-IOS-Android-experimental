import React, { useContext, useEffect, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SendFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";

// -------------------- Memoized File Item --------------------
const SendFileItem = memo(({ file, refProp }) => {
    const progressPercent = Math.min(
        (file.status.progress / file.metadata.size) * 100,
        100
    ).toFixed(2);

    // Format speed if available
    const formatSpeed = (bytesPerSec) => {
        if (!bytesPerSec || bytesPerSec <= 0) return "";
        return `${formatFileSize(bytesPerSec)}/s`;
    };

    // Dynamic status: show speed if sending
    const statusText =
        file.status.state === "sending"
            ? `sending (${formatSpeed(file.status.speed)})`
            : file.status.state;

    return (
        <li className="send-file-item" ref={refProp}>
            <div className="file-row file-name-row">
                <span className="file-name">{file.metadata.name}</span>
            </div>
            <div className="file-row file-progress-row">
                <span className="file-progress-text">
                    {formatFileSize(file.status.progress)} / {formatFileSize(file.metadata.size)}
                </span>
                <span className="file-status">{statusText}</span>
            </div>
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
});


// -------------------- Main SendFiles Component --------------------
const SendFiles = () => {
    const { files } = useContext(FileContext);
    const navigate = useNavigate();
    const itemRefs = useRef({});

    // Scroll to the first file that is currently sending
    useEffect(() => {
        const sendingFile = files.find(f => f.status.state === "sending");
        if (sendingFile && itemRefs.current[sendingFile.id]) {
            itemRefs.current[sendingFile.id].scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [files]);

    if (files.length === 0) {
        return (
            <div className="send-files-container">
                <p className="no-files-text">No files to send.</p>
            </div>
        );
    }

    return (
        <div className="send-files-container">
            <div className="send-files-list">
                <ul>
                    {files.map(file => (
                        <SendFileItem
                            key={file.id}
                            file={file}
                            refProp={el => (itemRefs.current[file.id] = el)}
                        />
                    ))}
                </ul>
            </div>

            <span className="back-button" onClick={() => navigate("/files")}>
                Return to File Selection
            </span>
        </div>
    );
};

export default SendFiles;
