import React, { useEffect, useRef, useCallback } from "react";
import QrScanner from "qr-scanner";
import { ArrowLeft } from "lucide-react";
import "../styles/QRScanner.css";

const QRScanner = ({ onScan, onBack, startScannerImmediately = false }) => {
    const videoRef = useRef(null);
    const qrScannerRef = useRef(null);

    const startScanner = useCallback(async () => {
        if (!videoRef.current) return;

        qrScannerRef.current = new QrScanner(
            videoRef.current,
            (result) => {
                const value = result?.data ?? (typeof result === "string" ? result : String(result));
                onScan(value);
                qrScannerRef.current?.stop();
            },
            {
                highlightScanRegion: true,
                highlightCodeOutline: true,
                preferredCamera: "environment", // Back camera
            }
        );

        try {
            await qrScannerRef.current.start();
        } catch (err) {
            console.warn("Camera permission denied or unavailable:", err);
        }
    }, [onScan]);

    useEffect(() => {
        if (startScannerImmediately) startScanner();

        return () => {
            qrScannerRef.current?.stop();
            qrScannerRef.current = null;
        };
    }, [startScannerImmediately, startScanner]);

    return (
        <div className="qr-scanner-container">
            <header className="scanner-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} /> Back
                </button>
                <h2 className="scanner-title">Scan QR Code</h2>
            </header>
            <div className="scanner-wrapper">
                <video ref={videoRef} className="qr-video" playsInline />
                <div className="scan-overlay" />
            </div>
        </div>
    );
};

export default QRScanner;
