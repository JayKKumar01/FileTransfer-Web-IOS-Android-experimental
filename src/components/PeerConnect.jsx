import "../styles/PeerConnect.css";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Copy, Check, Camera } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { usePeer } from "../contexts/PeerContext";
import QRScanner from "./QRScanner";
import { isAndroid } from "../utils/osUtil";

const PeerConnect = () => {
    const {
        peerId,
        connectToPeer,
        isPeerReady,
        isConnectionReady,
        remoteId,
        connectionStatus
    } = usePeer();

    const [targetId, setTargetId] = useState("");
    const [copied, setCopied] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [autoConnected, setAutoConnected] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const android = isAndroid();

    // ---------------- Trim scanned / input peer ID ----------------
    const trimResult = (result) => {
        if (!result) return undefined;
        let id = result.toString().trim();

        try {
            const url = new URL(id);
            let remote = url.searchParams.get("remoteId");
            if (!remote && url.hash) {
                const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
                remote = hashParams.get("remoteId");
            }
            if (remote) id = remote;
        } catch {
            // Not a URL, leave as-is
        }

        return id.replace(/^["']|["']$/g, "");
    };

    // ---------------- Connect to peer (input / QR scan) ----------------
    const connectWithId = useCallback(
        (id) => {
            if (!isPeerReady) return;

            const finalId = trimResult(id);
            if (!finalId) return;

            setTargetId(finalId);
            setShowScanner(false);
            connectToPeer(finalId);
        },
        [connectToPeer, isPeerReady]
    );

    // ---------------- Auto-connect from URL ----------------
    useEffect(() => {
        if (!isPeerReady || autoConnected) return;

        const params = new URLSearchParams(location.search);
        const urlRemoteId = params.get("remoteId");
        if (urlRemoteId) {
            connectWithId(urlRemoteId);
            setAutoConnected(true);
        }
    }, [location.search, connectWithId, autoConnected, isPeerReady]);

    // ---------------- Navigate on successful connection ----------------
    useEffect(() => {
        if (!isPeerReady || !isConnectionReady) return;

        const timer = setTimeout(() => navigate("/files"), 500);
        return () => clearTimeout(timer);
    }, [isPeerReady, isConnectionReady, navigate]);

    // ---------------- Copy shareable URL ----------------
    const copyToClipboard = () => {
        if (!peerId) return;
        const url = `${window.location.origin}${window.location.pathname}#?remoteId=${peerId}`;
        navigator.clipboard.writeText(url)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 800);
            })
            .catch(() => alert("Failed to copy link"));
    };

    // ---------------- Handle Enter key for input ----------------
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && targetId && connectionStatus === "idle") {
            connectWithId(targetId);
        }
    };

    if (!isPeerReady) return <p>Connecting to server...</p>;

    return (
        <div className="PeerConnect">
            {/* QR Scanner (Android only) */}
            {showScanner && android && (
                <QRScanner
                    onScan={connectWithId}
                    onBack={() => setShowScanner(false)}
                    startScannerImmediately
                />
            )}

            {!showScanner && (
                <>
                    {/* QR Scan Button */}
                    {android && (
                        <div className="scan-wrapper">
                            <button className="scan-btn" onClick={() => setShowScanner(true)}>
                                <Camera size={24} />
                            </button>
                            <span className="scan-label">Scan QR</span>
                        </div>
                    )}

                    {/* QR Code */}
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

                    {/* Display own peer ID with copy */}
                    <p className="id-row">
                        Your ID: <b>{peerId}</b>
                        <button
                            className={`copy-btn ${copied ? "copied" : ""}`}
                            onClick={copyToClipboard}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </p>

                    {/* Connection input / status */}
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
                                disabled={connectionStatus !== "idle"}
                            />
                            <button
                                onClick={() => connectWithId(targetId)}
                                disabled={!targetId || connectionStatus !== "idle"}
                            >
                                {connectionStatus === "idle" ? "Connect" : connectionStatus}
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
