import React, { useContext, useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { ArrowLeft } from "lucide-react";
import "../styles/QRScanner.css";
import { LogContext } from "../contexts/LogContext";

const QRScanner = ({ onScan, onBack, startScannerImmediately = false }) => {
    const videoRef = useRef(null);
    const qrScannerRef = useRef(null);
    const { pushLog } = useContext(LogContext);

    const log = (msg) => {
        console.log(msg);
        pushLog(msg);
    };

    const startScanner = async () => {
        if (!videoRef.current) return;

        qrScannerRef.current = new QrScanner(
            videoRef.current,
            (result) => {
                let value;
                if (typeof result === "string") value = result;
                else if (result?.data) value = result.data;
                else value = String(result);

                log("Final QR value: " + value);
                onScan(value);
                qrScannerRef.current?.stop();
            },
            {
                highlightScanRegion: true,
                highlightCodeOutline: true,
                preferredCamera: "environment", // back camera
            }
        );

        try {
            await qrScannerRef.current.start();

            // Explicit play needed for iOS
            if (videoRef.current) {
                await videoRef.current.play().catch(() => {
                    console.warn("iOS video autoplay requires user interaction");
                });
            }
        } catch (err) {
            log("Camera permission denied or unavailable: " + err);
        }
    };

    useEffect(() => {
        if (startScannerImmediately) {
            startScanner();
        }

        return () => {
            qrScannerRef.current?.stop();
        };
    }, [startScannerImmediately]);

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
