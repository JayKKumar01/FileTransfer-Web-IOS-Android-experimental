import React, { useContext, useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { ArrowLeft } from "lucide-react";
import "../styles/QRScanner.css";
import { LogContext } from "../contexts/LogContext";

const QRScanner = ({ onScan, onBack }) => {
    const videoRef = useRef(null);
    const qrScannerRef = useRef(null);
    const { pushLog } = useContext(LogContext);

    const log = (msg) => {
        console.log(msg);
        pushLog(msg);
    };

    useEffect(() => {
        if (!videoRef.current) return;

        const handleScanResult = (result) => {
            // Safely extract string value
            let value;
            if (typeof result === "string") {
                value = result;
            } else if (result && typeof result.data === "string") {
                value = result.data;
            } else {
                log("Unknown QR scan result object: " + JSON.stringify(result));
                value = String(result);
            }

            log("Final QR value: " + value);
            onScan(value);

            // Stop scanner after successful scan
            qrScannerRef.current?.stop();
        };

        qrScannerRef.current = new QrScanner(
            videoRef.current,
            handleScanResult,
            {
                highlightScanRegion: true,
                highlightCodeOutline: true,
            }
        );

        qrScannerRef.current.start().catch((err) => {
            log("Camera permission denied or unavailable: " + err);
        });

        return () => {
            qrScannerRef.current?.stop();
        };
    }, [onScan]);

    return (
        <div className="qr-scanner-container">
            <header className="scanner-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} /> Back
                </button>
                <h2 className="scanner-title">Scan QR Code</h2>
            </header>
            <div className="scanner-wrapper">
                <video ref={videoRef} className="qr-video" />
                <div className="scan-overlay" />
            </div>
        </div>
    );
};

export default QRScanner;
