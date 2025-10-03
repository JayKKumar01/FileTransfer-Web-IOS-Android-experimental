import "../styles/PeerConnect.css";
import React, { useState, useEffect, useCallback } from "react";
import { usePeer } from "../contexts/PeerContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Copy, Check, Camera } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import QRScanner from "./QRScanner";
import { isAndroid } from "../utils/osUtil";

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady, isConnectionReady, remoteId } = usePeer();
    const [targetId, setTargetId] = useState("");
    const [status, setStatus] = useState("Connect");
    const [copied, setCopied] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [hasAutoConnected, setHasAutoConnected] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const android = isAndroid();

    const connectWithId = useCallback((id) => {
        if (!id) return;

        let finalId = id;

        // If the scanned value is a full URL, extract the remoteId param
        try {
            const url = new URL(id);
            const urlRemoteId = url.searchParams.get("remoteId");
            if (urlRemoteId) finalId = urlRemoteId;
        } catch {
            // Not a valid URL, keep id as is
        }

        // Clean any extra quotes or spaces
        finalId = finalId.toString().trim().replace(/^["']|["']$/g, "");

        setTargetId(finalId);
        setShowScanner(false);

        setStatus("Connecting...");
        connectToPeer(finalId, (state) => {
            if (state?.startsWith("Retrying")) setStatus(state);
            else if (state === "failed") setStatus("Connect");
        });
    }, [connectToPeer]);


    // Auto-connect from URL only once
    useEffect(() => {
        if (hasAutoConnected) return;
        const params = new URLSearchParams(location.search);
        const urlRemoteId = params.get("remoteId");

        if (urlRemoteId) {
            connectWithId(urlRemoteId);
            setHasAutoConnected(true);
        }
    }, [location.search, connectWithId, hasAutoConnected]);

    // Navigate to files page on successful connection
    useEffect(() => {
        if (!isConnectionReady) return;
        setTargetId("");
        setStatus("Connected ✅");
        const timer = setTimeout(() => navigate("/files"), 500);
        return () => clearTimeout(timer);
    }, [isConnectionReady, navigate]);

    if (!isPeerReady) return <p>Connecting to server...</p>;

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && status === "Connect" && targetId) connectWithId(targetId);
    };

    const copyToClipboard = () => {
        if (!peerId) return;
        navigator.clipboard.writeText(peerId)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 800);
            })
            .catch(() => alert("Failed to copy ID"));
    };

    return (
        <div className="PeerConnect">
            {showScanner && android && (
                <QRScanner
                    onScan={connectWithId}
                    onBack={() => setShowScanner(false)}
                    startScannerImmediately
                />
            )}

            {!showScanner && (
                <>
                    {android && (
                        <div className="scan-wrapper">
                            <button
                                className="scan-btn"
                                onClick={() => setShowScanner(true)}
                            >
                                <Camera size={24} />
                            </button>
                            <span className="scan-label">Scan QR</span>
                        </div>
                    )}

                    {peerId && (
                        <div className="qr-container">
                            <QRCodeCanvas
                                // Encode the full shareable URL instead of just peerId
                                value={`${window.location.origin}${window.location.pathname}#?remoteId=${peerId}`}
                                size={120}
                                bgColor="#1a1a1a"
                                fgColor="#ffffff"
                            />
                        </div>
                    )}

                    <p className="id-row">
                        Your ID: <b>{peerId}</b>
                        <button
                            className={`copy-btn ${copied ? "copied" : ""}`}
                            onClick={copyToClipboard}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </p>

                    {!isConnectionReady ? (
                        <div className="connect-inputs">
                            <input
                                type="tel"
                                pattern="[0-9]*"
                                inputMode="numeric"
                                placeholder="Enter peer ID"
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={status !== "Connect"}
                            />
                            <button
                                onClick={() => connectWithId(targetId)}
                                disabled={!targetId || status !== "Connect"}
                            >
                                {status}
                            </button>
                        </div>
                    ) : (
                        <p>Connected with peer: <b>{remoteId}</b> ✅</p>
                    )}
                </>
            )}
        </div>
    );
};

export default PeerConnect;
