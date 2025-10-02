import React, {useContext, memo, useRef, useEffect, useState, useMemo, useCallback} from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";
import { Download } from "lucide-react";
import {isApple} from "../utils/osUtil";
import JSZip from "jszip";
import {downloadZip} from "../utils/zipUtil"; // npm install jszip


// -------------------- Memoized Download Item --------------------
const ReceiveFileItem = memo(({ download, refProp, onRemove }) => {
    const [isRemoving, setIsRemoving] = useState(false);

    const progressPercent = Math.min(
        (download.status.progress / download.metadata.size) * 100,
        100
    ).toFixed(2);

    const formatSpeed = (bytesPerSec) =>
        !bytesPerSec || bytesPerSec <= 0 ? "" : `${formatFileSize(bytesPerSec)}/s`;

    const statusText =
        download.status.state === "receiving"
            ? `${formatSpeed(download.status.speed)}`
            : download.status.state;

    const hasBlob = Boolean(download.status.blob);

    const handleClick = () => {
        if (!hasBlob) return;

        if (download.status.blob) {
            URL.revokeObjectURL(download.status.blob);
        }

        setIsRemoving(true);
        setTimeout(() => onRemove(download.id), 300); // match animation duration
    };

    return (
        <li
            className={`receive-file-item ${isRemoving ? "removing" : ""}`}
            ref={refProp}
        >
            <div className="file-row file-name-row">
                <span className="file-name">{download.metadata.name}</span>
            </div>

            <div className="file-row file-progress-row">
                <span className="file-progress-text">
                    {formatFileSize(download.status.progress)} / {formatFileSize(download.metadata.size)}
                </span>

                <span className="file-status">{statusText}</span>

                {isApple() && (
                    <a
                        href={hasBlob ? URL.createObjectURL(download.status.blob) : undefined}
                        download={download.metadata.name}
                        className={`download-link ${!hasBlob ? "disabled" : ""}`}
                        title={hasBlob ? "Download & Remove" : "Not ready"}
                        onClick={handleClick}
                        style={{
                            pointerEvents: hasBlob ? "auto" : "none",
                            opacity: hasBlob ? 1 : 0.5,
                        }}
                    >
                        <Download size={16} />
                    </a>
                )}
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
    const { downloads, removeDownload } = useContext(FileContext);
    const itemRefs = useRef({});
    const [zipProgress, setZipProgress] = useState(0); // 0-100

    // Memoized applicable downloads (only blobs under 50MB)
    const zipApplicableDownloads = useMemo(() =>
        downloads.reduce((acc, d) => {
            if (d.status.blob && d.status.blob.size < 500 * 1024 * 1024) acc.push(d);
            return acc;
        }, []), [downloads]);

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




    const handleDownloadAll = async (downloadsToZip) => {
        await downloadZip(downloadsToZip, "myFiles.zip");
    };

    if (!downloads.length) {
        return (
            <div className="receive-files-container">
                <p className="no-files-text">No files received yet.</p>
            </div>
        );
    }

    return (
        <div className="receive-files-container">
            <p className="note">Note: Files larger than 50 mb, won't be added in Zip</p>
            <div className="receive-files-list">
                <ul>
                    {downloads.map(download => (
                        <ReceiveFileItem
                            key={download.id}
                            download={download}
                            refProp={el => (itemRefs.current[download.id] = el)}
                            onRemove={removeDownload}
                        />

                    ))}
                </ul>
            </div>

            {/* Zipping Progress */}
            {zipProgress > 0 && (
                <div className="zip-progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${zipProgress}%` }} />
                    </div>
                    <span className="progress-text">Zipping... {zipProgress}%</span>
                </div>
            )}

            {/* Download All Button */}
            {isApple() && downloads.length > 1 && !zipProgress && (
                <button
                    className="download-all-zip-btn"
                    onClick={() => handleDownloadAll(downloads)}
                >
                    Download All as ZIP
                </button>
            )}

        </div>
    );
};

export default ReceiveFiles;
