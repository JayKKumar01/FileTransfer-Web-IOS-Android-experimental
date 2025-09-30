import React, { useContext, memo, useRef, useEffect } from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";

// -------------------- Memoized Download Item --------------------
const ReceiveFileItem = memo(({ download, refProp }) => {
    const progressPercent = Math.min(
        (download.status.progress / download.metadata.size) * 100,
        100
    ).toFixed(2);

    // Format speed if available
    const formatSpeed = (bytesPerSec) => {
        if (!bytesPerSec || bytesPerSec <= 0) return "";
        return `${formatFileSize(bytesPerSec)}/s`;
    };

    const statusText =
        download.status.state === "receiving"
            ? `${formatSpeed(download.status.speed)}`
            : download.status.state;

    return (
        <li className="receive-file-item" ref={refProp}>
            <div className="file-row file-name-row">
                <span className="file-name">{download.metadata.name}</span>
            </div>
            <div className="file-row file-progress-row">
                <span className="file-progress-text">
                    {formatFileSize(download.status.progress)} / {formatFileSize(download.metadata.size)}
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

// -------------------- Main ReceiveFiles Component --------------------
const ReceiveFiles = () => {
    const { downloads } = useContext(FileContext);
    const itemRefs = useRef({});

    // Scroll to the first file that is currently receiving
    useEffect(() => {
        const activeDownload = downloads.find(d => d.status.state === "receiving");
        if (activeDownload && itemRefs.current[activeDownload.id]) {
            itemRefs.current[activeDownload.id].scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [downloads]);

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
                    {downloads.map(download => (
                        <ReceiveFileItem
                            key={download.id}
                            download={download}
                            refProp={el => (itemRefs.current[download.id] = el)}
                        />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ReceiveFiles;
