import "../styles/PeerConnect.css";
import React, { useState, useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Camera } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import QRScanner from "./QRScanner"; // QR scanner component

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady, isConnectionReady, remoteId } = usePeer();
    const [targetId, setTargetId] = useState("");
    const [status, setStatus] = useState("Connect");
    const [copied, setCopied] = useState(false);
    const [showScanner, setShowScanner] = useState(false); // toggle scanner
    const navigate = useNavigate();

    // Navigate to /files once connection is ready
    useEffect(() => {
        if (isConnectionReady) {
            setTargetId("");
            setStatus("Connected ✅");

            const timer = setTimeout(() => navigate("/files"), 500);
            return () => clearTimeout(timer);
        }
    }, [isConnectionReady, navigate]);

    if (!isPeerReady) return <p>Connecting to server...</p>;

    const handleConnect = () => {
        if (!targetId) return;
        setStatus("Connecting...");
        connectToPeer(targetId, (state) => {
            if (state?.startsWith("Retrying")) setStatus(state);
            else if (state === "failed") setStatus("Connect");
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && status === "Connect" && targetId) handleConnect();
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

    const handleScan = (scannedId) => {
        setTargetId(scannedId);
        setShowScanner(false);
        handleConnect(); // connect immediately after scan
    };

    return (
        <div className="PeerConnect">
            {showScanner ? (
                <QRScanner
                    onScan={handleScan}
                    onBack={() => setShowScanner(false)}
                />
            ) : (
                <>
                    {/* Scan QR button at top-right */}
                    <button className="scan-btn" onClick={() => setShowScanner(true)}>
                        <Camera size={16} /> Scan QR
                    </button>

                    {/* QR code */}
                    {peerId && (
                        <div className="qr-container">
                            <QRCodeCanvas
                                value={`${peerId}`}
                                size={120}
                                bgColor="#1a1a1a"
                                fgColor="#ffffff"
                            />
                        </div>
                    )}

                    {/* Peer ID display with copy */}
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
                        <>
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
                                onClick={handleConnect}
                                disabled={!targetId || status !== "Connect"}
                            >
                                {status}
                            </button>
                        </>
                    ) : (
                        <p>
                            Connected with peer: <b>{remoteId}</b> ✅
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default PeerConnect;
