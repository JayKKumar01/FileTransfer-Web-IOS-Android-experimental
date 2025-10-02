import React, {useContext, memo, useRef, useEffect, useState, useMemo, useCallback} from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { formatFileSize } from "../utils/fileUtil";
import { Download } from "lucide-react";
import {isApple} from "../utils/osUtil";
import {downloadZip} from "../utils/zipUtil"; // npm install jszip


// -------------------- Memoized Download Item --------------------
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

    // Check if we have any blob parts ready
    const hasBlobParts = Array.isArray(download.status.blobs) && download.status.blobs.length > 0;

    const handleClick = () => {
        if (!hasBlobParts) return;

        // Revoke URLs for all blobs if previously created
        download.status.blobs.forEach(blobPart => {
            if (blobPart.__url) {
                URL.revokeObjectURL(blobPart.__url);
            }
        });

        setIsRemoving(true);
        setTimeout(() => onRemove(download.id), 300); // match animation duration
    };

    // Create a single downloadable blob URL on demand
    const downloadUrl = hasBlobParts
        ? (() => {
            const fullBlob = new Blob(download.status.blobs);
            fullBlob.__url = URL.createObjectURL(fullBlob);
            return fullBlob.__url;
        })()
        : undefined;

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
                        href={hasBlobParts ? downloadUrl : undefined}
                        download={download.metadata.name}
                        className={`download-link ${!hasBlobParts ? "disabled" : ""}`}
                        title={hasBlobParts ? "Download & Remove" : "Not ready"}
                        onClick={handleClick}
                        style={{
                            pointerEvents: hasBlobParts ? "auto" : "none",
                            opacity: hasBlobParts ? 1 : 0.5,
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


    // -------------------- Simulate Downloads --------------------
    async function simulateDownloadsAsync(numFiles = 10, partsPerFile = 512, partSizeMB = 2) {
        const downloads = [];

        for (let i = 0; i < numFiles; i++) {
            const blobParts = [];

            for (let j = 0; j < partsPerFile; j++) {
                const buffer = new Uint8Array(partSizeMB * 1024 * 1024);
                blobParts.push(new Blob([buffer]));

                // Progress logging every 50 parts
                if (j % 50 === 0) {
                    console.log(`File ${i + 1}/${numFiles}: ${((j / partsPerFile) * 100).toFixed(1)}%`);
                    await new Promise(r => setTimeout(r, 0)); // yield to UI
                }
            }

            downloads.push({
                id: `file_${i + 1}`,
                metadata: {
                    name: `file_${i + 1}.bin`,
                    size: partsPerFile * partSizeMB * 1024 * 1024, // total size
                },
                status: {
                    state: "completed",
                    progress: partsPerFile * partSizeMB * 1024 * 1024,
                    blobs: blobParts,   // store all parts separately
                    speed: 0,
                },
            });

            console.log(`✅ File ${i + 1} created`);
            await new Promise(r => setTimeout(r, 0)); // let UI breathe
        }

        return downloads;
    }


    async function handleDownloadAll() {
        await downloadZip(downloads, "myFiles.zip", (percent) => {
            setZipProgress(percent);
            console.log("Overall ZIP progress:", percent, "%");
        });

        setTimeout(() => {
            setZipProgress(0);
        }, 500);

    }


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
                    onClick={() => handleDownloadAll()}
                >
                    Download All as ZIP
                </button>
            )}

        </div>
    );
};

export default ReceiveFiles;
