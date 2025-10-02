import React, { memo, useRef, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatFileSize } from "../utils/fileUtil";
import { isApple } from "../utils/osUtil";

const ReceiveFileItem = memo(({ download, refProp, onRemove, isZipped }) => {
    const [isRemoving, setIsRemoving] = useState(false);
    const urlRef = useRef(null);

    useEffect(() => {
        if (isZipped && download) {  // ensure download exists
            setIsRemoving(true);
            const timer = setTimeout(() => {
                onRemove?.(download.id); // optional chaining for safety
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isZipped, download, onRemove]);





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

    const hasBlobParts = Array.isArray(download.status.blobs) && download.status.blobs.length > 0;

    // Generate blob URL once and cleanup on unmount
    useEffect(() => {
        if (hasBlobParts && !urlRef.current) {
            const fullBlob = new Blob(download.status.blobs);
            urlRef.current = URL.createObjectURL(fullBlob);
        }

        return () => {
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, [download.status.blobs, hasBlobParts]);

    const handleClick = () => {
        if (!hasBlobParts) return;

        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }

        setIsRemoving(true);
        setTimeout(() => onRemove(download.id), 300);
    };

    return (
        <li className={`receive-file-item ${isRemoving ? "removing" : ""}`} ref={refProp}>
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
                        href={hasBlobParts ? urlRef.current : undefined}
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
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
            </div>
        </li>
    );
});

export default ReceiveFileItem;
