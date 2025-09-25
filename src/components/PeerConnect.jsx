import "./PeerConnect.css";
import React, { useState, useEffect } from "react";
import { usePeer } from "../contexts/PeerContext";

const PeerConnect = () => {
    const { peerId, connectToPeer, isPeerReady, isConnectionReady, remoteId } = usePeer();
    const [targetId, setTargetId] = useState("");
    const [status, setStatus] = useState("Connect");

    useEffect(() => {
        if (isConnectionReady) {
            setTargetId(""); // Clear input after connection
            setStatus("Connected ✅");
        }
    }, [isConnectionReady]);

    if (!isPeerReady) return <p>Connecting to server...</p>;

    const handleConnect = () => {
        if (!targetId) return;
        setStatus("Connecting...");

        connectToPeer(targetId, (state) => {
            if (state?.startsWith("Retrying")) {
                setStatus(state);
            } else if (state === "failed") {
                setStatus("Connect");
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
                        disabled={status !== "Connect"}
                    />
                    <button
                        onClick={handleConnect}
                        disabled={!targetId || status !== "Connect"}
                    >
                        {status}
                    </button>
                </>
            )}

            {isConnectionReady && remoteId && (
                <p>Connected with peer: <b>{remoteId}</b> ✅</p>
            )}
        </div>
    );
};

export default PeerConnect;
