import "../styles/PeerConnect.css";
import React, { useState, useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";
import { useNavigate } from "react-router-dom";
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
    const navigate = useNavigate();

    const android = isAndroid();

    // Navigate to files page on successful connection
    useEffect(() => {
        if (!isConnectionReady) return;
        setTargetId("");
        setStatus("Connected ✅");
        const timer = setTimeout(() => navigate("/files"), 500);
        return () => clearTimeout(timer);
    }, [isConnectionReady, navigate]);

    if (!isPeerReady) return <p>Connecting to server...</p>;

    // Unified function to connect using manual input or scanned QR
    const connectWithId = (id) => {
        if (!id) return;

        const cleanedId = id
            ? (() => {
                try { return JSON.parse(id); }
                catch { return id; }
            })()
            : "";

        const finalId = cleanedId.toString().trim().replace(/^["']|["']$/g, "");
        setTargetId(finalId);
        setShowScanner(false);

        setStatus("Connecting...");
        connectToPeer(finalId, (state) => {
            if (state?.startsWith("Retrying")) setStatus(state);
            else if (state === "failed") setStatus("Connect");
        });
    };

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
            {/* QR Scanner only for Android */}
            {showScanner && android && (
                <QRScanner
                    onScan={connectWithId}
                    onBack={() => setShowScanner(false)}
                    startScannerImmediately
                />
            )}

            {!showScanner && (
                <>
                    {/* Scan QR button only for Android */}
                    {android && (
                        <button
                            className="scan-btn"
                            onClick={() => setShowScanner(true)}
                        >
                            <Camera size={16} /> Scan QR
                        </button>
                    )}

                    {/* QR Code */}
                    {peerId && (
                        <div className="qr-container">
                            <QRCodeCanvas
                                value={JSON.stringify(peerId)}
                                size={120}
                                bgColor="#1a1a1a"
                                fgColor="#ffffff"
                            />
                        </div>
                    )}

                    {/* Peer ID display */}
                    <p className="id-row">
                        Your ID: <b>{peerId}</b>
                        <button
                            className={`copy-btn ${copied ? "copied" : ""}`}
                            onClick={copyToClipboard}
                        >
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
