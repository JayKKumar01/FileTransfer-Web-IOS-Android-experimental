import "../styles/PeerConnect.css";
import React, { useState, useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Camera } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import QRScanner from "./QRScanner";

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady, isConnectionReady, remoteId } = usePeer();
    const [targetId, setTargetId] = useState("");
    const [status, setStatus] = useState("Connect");
    const [copied, setCopied] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (isConnectionReady) {
            setTargetId("");
            setStatus("Connected ✅");
            const timer = setTimeout(() => navigate("/files"), 500);
            return () => clearTimeout(timer);
        }
    }, [isConnectionReady, navigate]);

    if (!isPeerReady) return <p>Connecting to server...</p>;

    const handleConnect = (id = targetId) => {
        if (!id) return;
        setStatus("Connecting...");
        connectToPeer(id, (state) => {
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
        let id = scannedId;

        try {
            // Try parsing JSON (since QR value is JSON.stringify(peerId))
            id = JSON.parse(scannedId);
        } catch {
            console.warn("Failed to parse JSON from QR");
        }

        // Sanitize: remove any leading/trailing whitespace or quotes
        id = id.toString().trim().replace(/^["']|["']$/g, "");

        setTargetId(id);
        setShowScanner(false);
        handleConnect(id); // connect immediately with clean string
    };

    return (
        <div className="PeerConnect">
            {showScanner ? (
                <QRScanner
                    onScan={handleScan}
                    onBack={() => setShowScanner(false)}
                    startScannerImmediately={true} // <-- add this prop
                />
            ) : (
                <>
                    {/* Scan QR button at top-right */}
                    <button
                        className="scan-btn"
                        onClick={() => setShowScanner(true)} // user click triggers scanner
                    >
                        <Camera size={16} /> Scan QR
                    </button>

                    {/* QR code */}
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
                                onClick={() => handleConnect()}
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
