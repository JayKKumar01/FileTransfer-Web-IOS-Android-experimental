import React, { useContext, useRef, useEffect, useState, useMemo } from "react";
import "../styles/ReceiveFiles.css";
import { FileContext } from "../contexts/FileContext";
import { isApple } from "../utils/osUtil";
import { downloadZip } from "../utils/zipUtil";
import ReceiveFileItem from "./ReceiveFileItem";
import {usePeer} from "../contexts/PeerContext";

const MAX_ZIP_TOTAL = 4 * 1024 ** 3; // 4 GB

const ReceiveFiles = () => {
    const { downloads, removeDownload } = useContext(FileContext);
    const { isConnectionLost } = usePeer();
    const itemRefs = useRef({});
    const [zipProgress, setZipProgress] = useState(0);
    const [zippedIds, setZippedIds] = useState(new Set());

    // Count of completed downloads
    const completedCount = useMemo(
        () => downloads.filter(d => d.status.state === "received" || d.status.state === "downloaded").length,
        [downloads]
    );

    const allReceived = useMemo(
        () => downloads.length > 0 && completedCount === downloads.length,
        [downloads, completedCount]
    );

    const scrolledDownloads = useRef(new Set());

    // Auto-scroll to first active download
    useEffect(() => {
        const activeDownload = downloads.find(
            d => d.status.state === "receiving" && !scrolledDownloads.current.has(d.id)
        );
        if (activeDownload && itemRefs.current[activeDownload.id]) {
            itemRefs.current[activeDownload.id].scrollIntoView({ behavior: "smooth", block: "center" });
            scrolledDownloads.current.add(activeDownload.id);
        }
    }, [downloads]);

    // Handle "Download All as ZIP" respecting 4GB rules
    const handleDownloadAll = async () => {
        let totalSize = 0;
        const downloadsToZip = [];

        for (const d of downloads) {
            const fileSize = d.metadata.size;

            if (fileSize > MAX_ZIP_TOTAL) continue;         // Skip files > 4GB
            if (totalSize + fileSize > MAX_ZIP_TOTAL) break; // Stop at 4GB total

            downloadsToZip.push({ ...d });
            totalSize += fileSize;
        }

        if (!downloadsToZip.length) return;

        await downloadZip(
            downloadsToZip,
            percent => setZipProgress(percent),
            id => setZippedIds(prev => new Set(prev).add(id))
        );

        setTimeout(() => setZipProgress(0), 500);
    };

    // Warnings
    const warnings = [];
    // Calculate total size for ZIP (skip individual files > 4GB)
    const totalSize = downloads
        .filter(d => d.metadata.size <= MAX_ZIP_TOTAL)
        .reduce((acc, d) => acc + d.metadata.size, 0);
    const hasLargeFile = downloads.some(d => d.metadata.size > MAX_ZIP_TOTAL);

    if (totalSize > MAX_ZIP_TOTAL) {
        warnings.push(
            "ZIP includes files up to 4 GB. If the total size exceeds this, only files up to 4 GB are added; remaining files stay available for the next ZIP download."
        );
    }
    if (hasLargeFile) {
        warnings.push(
            "Files over 4 GB are skipped in ZIP – download individually."
        );
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
            <div className="downloads-count">
                Received: {completedCount} / {downloads.length}
            </div>

            {warnings.length > 0 && (
                <div className="warnings-container">
                    {warnings.map((warning, i) => (
                        <div key={i} className="file-warning">⚠️ {warning}</div>
                    ))}
                </div>
            )}

            <div className="receive-files-list">
                <ul>
                    {downloads.map(d => (
                        <ReceiveFileItem
                            key={d.id}
                            download={d}
                            refProp={el => (itemRefs.current[d.id] = el)}
                            onRemove={removeDownload}
                            isZipped={zippedIds.has(d.id)}
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

            {isApple() && downloads.length > 1 && !zipProgress &&
                (isConnectionLost ? completedCount > 1 : allReceived) && (
                    <button
                        className="download-all-zip-btn"
                        onClick={handleDownloadAll}
                        title="Download All as ZIP"
                    >
                        Download All as ZIP
                    </button>
                )
            }
        </div>
    );
};

export default ReceiveFiles;
