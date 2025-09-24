import "./PeerConnect.css";
import React, { useState } from "react";
import { usePeer } from "../contexts/PeerContext";

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady } = usePeer();
    const [targetId, setTargetId] = useState("");
    const [buttonLabel, setButtonLabel] = useState("Connect"); // Button status

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

        connectToPeer(targetId, (state) => {
            switch (state) {
                case "retrying":
                    setButtonLabel("Retrying...");
                    break;
                case "connected":
                    setButtonLabel("Connected ✅");
                    break;
                case "failed":
                    setButtonLabel("Failed – Invalid ID");
                    break;
                default:
                    setButtonLabel("Connect");
            }
        });
    };

    return (
        <div className="PeerConnect">
            <p>Your ID: <b>{peerId}</b></p>
            <input
                type="tel"
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="Enter peer ID"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
            />
            <button onClick={handleConnect}>{buttonLabel}</button>
        </div>
    );
};

export default PeerConnect;
