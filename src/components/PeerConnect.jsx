import "./PeerConnect.css";
import React, { useState } from "react";
import { usePeer } from "../contexts/PeerContext";

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady } = usePeer();
    const [targetId, setTargetId] = useState("");

    if (!isPeerReady) {
        return (
            <div className="PeerConnect">
                <p>Connecting to server...</p>
            </div>
        );
    }

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
            <button onClick={() => connectToPeer(targetId)}>Connect</button>
        </div>
    );
};

export default PeerConnect;
