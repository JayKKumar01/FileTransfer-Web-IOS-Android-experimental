import "./PeerConnect.css";
import React, { useState, useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady, isConnectionReady, remoteId } = usePeer();
    const [targetId, setTargetId] = useState("");
    const [buttonLabel, setButtonLabel] = useState("Connect");
    const [connecting, setConnecting] = useState(false);

    // Reset targetId when connection is ready
    useEffect(() => {
        if (isConnectionReady) {
            setTargetId("");
            setConnecting(false);
        }
    }, [isConnectionReady]);

    if (!isPeerReady) {
        return (
            <div className="PeerConnect">
                <p>Connecting to server...</p>
            </div>
        );
    }

    const handleConnect = () => {
        if (!targetId) return;

        setButtonLabel("Connecting...");
        setConnecting(true);

        connectToPeer(targetId, (state) => {
            // Update button label dynamically for retries
            if (state?.startsWith("Retrying")) {
                setButtonLabel(state);
            } else if (state === "failed") {
                setButtonLabel("Connect");
                setConnecting(false);
            }
        });
    };

    return (
        <div className="PeerConnect">
            <p>Your ID: <b>{peerId}</b></p>

            {!isConnectionReady && (
                <>
                    <input
                        type="tel"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="Enter peer ID"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        disabled={connecting}
                    />
                    <button
                        onClick={handleConnect}
                        disabled={connecting || !targetId}
                    >
                        {buttonLabel}
                    </button>
                </>
            )}

            {isConnectionReady && remoteId && (
                <p>
                    Connected with peer: <b>{remoteId}</b> ✅
                </p>
            )}
        </div>
    );
};

export default PeerConnect;
