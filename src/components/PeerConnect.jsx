import "../styles/PeerConnect.css";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Copy, Check, Camera } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { usePeer } from "../contexts/PeerContext";
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

    // --- Trim scanned or input value to extract peerId ---
    const trimResult = (result) => {
        if (!result) return undefined;
        let id = result.toString().trim();

        try {
            const url = new URL(id);
            let remoteId = url.searchParams.get("remoteId");
            if (!remoteId && url.hash) {
                const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
                remoteId = hashParams.get("remoteId");
            }
            if (remoteId) id = remoteId;
        } catch {
            // Not a URL, keep as-is
        }

        return id.replace(/^["']|["']$/g, "");
    };

    // --- Unified connect function ---
    const connectWithId = useCallback(
        (id) => {
            if (!isPeerReady) return; // Don't do anything until peer is ready

            const finalId = trimResult(id);
            if (!finalId) return;

            setTargetId(finalId);
            setShowScanner(false);
            setStatus("Connecting...");

            connectToPeer(finalId, (state) => {
                if (state?.startsWith("Retrying")) setStatus(state);
                else if (state === "failed") setStatus("Connect");
            });
        },
        [connectToPeer, isPeerReady]
    );

    // --- Auto-connect from URL query (once) ---
    useEffect(() => {
        if (!isPeerReady || hasAutoConnected) return;

        const params = new URLSearchParams(location.search);
        const urlRemoteId = params.get("remoteId");

        if (urlRemoteId) {
            connectWithId(urlRemoteId);
            setHasAutoConnected(true);
        }
    }, [location.search, connectWithId, hasAutoConnected, isPeerReady]);

    // --- Navigate to files page on successful connection ---
    useEffect(() => {
        if (!isPeerReady || !isConnectionReady) return;

        setTargetId("");
        setStatus("Connected ✅");

        const timer = setTimeout(() => navigate("/files"), 500);
        return () => clearTimeout(timer);
    }, [isPeerReady, isConnectionReady, navigate]);

    if (!isPeerReady) return <p>Connecting to server...</p>;

    // --- Event handlers ---
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && status === "Connect" && targetId) connectWithId(targetId);
    };

    const copyToClipboard = () => {
        if (!peerId) return;
        const shareableURL = `${window.location.origin}${window.location.pathname}#?remoteId=${peerId}`;
        navigator.clipboard.writeText(shareableURL)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 800);
            })
            .catch(() => alert("Failed to copy link"));
    };

    return (
        <div className="PeerConnect">
            {/* QR Scanner (Android only) */}
            {showScanner && android && (
                <QRScanner
                    onScan={(result) => connectWithId(result)}
                    onBack={() => setShowScanner(false)}
                    startScannerImmediately
                />
            )}

            {!showScanner && (
                <>
                    {/* Scan button (Android only) */}
                    {android && (
                        <div className="scan-wrapper">
                            <button className="scan-btn" onClick={() => setShowScanner(true)}>
                                <Camera size={24} />
                            </button>
                            <span className="scan-label">Scan QR</span>
                        </div>
                    )}

                    {/* QR Code for sharing */}
                    {peerId && (
                        <div className="qr-container">
                            <QRCodeCanvas
                                value={`${window.location.origin}${window.location.pathname}#?remoteId=${peerId}`}
                                size={120}
                                bgColor="#1a1a1a"
                                fgColor="#ffffff"
                            />
                        </div>
                    )}

                    {/* Display peer ID with copy button */}
                    <p className="id-row">
                        Your ID: <b>{peerId}</b>
                        <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyToClipboard}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </p>

                    {/* Connection input */}
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
