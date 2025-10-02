import React, { memo, useRef, useEffect, useState, useMemo } from "react";
import { Download } from "lucide-react";
import { formatFileSize } from "../utils/fileUtil";
import { isApple } from "../utils/osUtil";

const MAX_ZIP_SIZE = 4 * 1024 ** 3; // 4 GB

const ReceiveFileItem = memo(({ download, refProp, onRemove, isZipped }) => {
    const [isRemoving, setIsRemoving] = useState(false);
    const urlRef = useRef(null);

    const hasBlobParts = useMemo(
        () => Array.isArray(download.status.blobs) && download.status.blobs.length > 0,
        [download.status.blobs]
    );

    // Calculate total size of all blobs
    const totalBlobSize = useMemo(
        () => download.status.blobs?.reduce((acc, blob) => acc + blob.size, 0) || 0,
        [download.status.blobs]
    );

    const exceedsZipLimit = totalBlobSize > MAX_ZIP_SIZE;

    const progressPercent = useMemo(
        () => Math.min((download.status.progress / download.metadata.size) * 100, 100).toFixed(2),
        [download.status.progress, download.metadata.size]
    );

    const statusText = useMemo(() => {
        return download.status.state === "receiving"
            ? download.status.speed > 0
                ? `${formatFileSize(download.status.speed)}/s`
                : ""
            : download.status.state;
    }, [download.status.state, download.status.speed]);

    // Create blob URL once and clean up on unmount
    useEffect(() => {
        if (hasBlobParts && !urlRef.current) {
            const blob = new Blob(download.status.blobs);
            urlRef.current = URL.createObjectURL(blob);
        }
        return () => {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, [download.status.blobs, hasBlobParts]);

    // Trigger removal animation if zipped
    useEffect(() => {
        if (isZipped && download) {
            setIsRemoving(true);
            const timer = setTimeout(() => onRemove?.(download.id), 300);
            return () => clearTimeout(timer);
        }
    }, [isZipped, download, onRemove]);

    const handleClick = () => {
        if (!hasBlobParts) return;

        const link = document.createElement("a");
        link.href = urlRef.current;
        link.download = download.metadata.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIsRemoving(true);
        setTimeout(() => onRemove?.(download.id), 300);
    };

    return (
        <li className={`receive-file-item ${isRemoving ? "removing" : ""}`} ref={refProp}>
            {exceedsZipLimit && (
                <div className="file-warning">
                    ⚠️ File over 4GB – ZIP skips it. Download individually.
                </div>

            )}
            <div className="file-row file-name-row">
                <span className="file-name">{download.metadata.name}</span>
            </div>

            <div className="file-row file-progress-row">
                <span className="file-progress-text">
                    {formatFileSize(download.status.progress)} / {formatFileSize(download.metadata.size)}
                </span>
                <span className="file-status">{statusText}</span>
                {isApple() && (
                    <button
                        className={`download-link ${!hasBlobParts ? "disabled" : ""}`}
                        title={hasBlobParts ? "Download & Remove" : "Not ready"}
                        onClick={handleClick}
                        disabled={!hasBlobParts}
                        style={{ opacity: hasBlobParts ? 1 : 0.5 }}
                    >
                        <Download size={16} />
                    </button>
                )}
            </div>

            <div className="file-row progress-bar-row">
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
            </div>
        </li>
    );
});

export default ReceiveFileItem;
