import React, { useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { ArrowLeft } from "lucide-react";
import "../styles/QRScanner.css";

const QRScanner = ({ onScan, onBack }) => {
    const videoRef = useRef(null);
    const qrScannerRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            qrScannerRef.current = new QrScanner(
                videoRef.current,
                (result) => {
                    onScan(result);
                    qrScannerRef.current.stop();
                },
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                }
            );

            qrScannerRef.current.start().catch((err) => {
                console.error("Camera permission denied or unavailable", err);
            });
        }

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
