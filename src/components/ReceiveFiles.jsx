import React, { useContext, useRef, useEffect, useState, useMemo } from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { isApple } from "../utils/osUtil";
import { downloadZip } from "../utils/zipUtil";
import ReceiveFileItem from "./ReceiveFileItem";

const ReceiveFiles = () => {
    const { downloads, removeDownload } = useContext(FileContext);
    const itemRefs = useRef({});
    const [zipProgress, setZipProgress] = useState(0);
    const [zippedIds, setZippedIds] = useState(new Set());

    const allReceived = useMemo(
        () => downloads.length > 0 && downloads.every(d => d.status.state === "received"),
        [downloads]
    );

    const scrolledDownloads = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Find the first receiving download that hasn't been scrolled yet
        const activeDownload = downloads.find(
            d => d.status.state === "receiving" && !scrolledDownloads.current.has(d.id)
        );

        if (activeDownload && itemRefs.current[activeDownload.id]) {
            itemRefs.current[activeDownload.id].scrollIntoView({
                behavior: "smooth",
                block: "center",
            });

            // Mark this download as scrolled
            scrolledDownloads.current.add(activeDownload.id);
        }
    }, [downloads]);

    const handleDownloadAll = async () => {
        // Create a static snapshot of downloads at this moment
        const downloadsSnapshot = downloads.map(d => ({
            ...d,
            status: { ...d.status, blobs: [...d.status.blobs] },
            metadata: { ...d.metadata }
        }));

        await downloadZip(
            downloadsSnapshot,                    // pass static copy
            (percent) => setZipProgress(percent), // overall progress
            (id) => setZippedIds(prev => new Set(prev).add(id)) // mark individual file as zipped
        );

        setTimeout(() => setZipProgress(0), 500);
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
            <div className="receive-files-list">
                <ul>
                    {downloads.map(download => (
                        <ReceiveFileItem
                            key={download.id}
                            download={download}
                            refProp={el => (itemRefs.current[download.id] = el)}
                            onRemove={removeDownload}
                            isZipped={zippedIds.has(download.id)} // pass zipped flag
                        />
                    ))}
                </ul>
            </div>

            {zipProgress > 0 && (
                <div className="zip-progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${zipProgress}%` }} />
                    </div>
                    <span className="progress-text">Zipping... {zipProgress}%</span>
                </div>
            )}

            {isApple() && downloads.length > 1 && !zipProgress && allReceived && (
                <button
                    className="download-all-zip-btn"
                    onClick={handleDownloadAll}
                    title="Download All as ZIP"
                >
                    Download All as ZIP
                </button>
            )}
        </div>
    );
};

export default ReceiveFiles;
