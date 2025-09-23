import "./PeerConnect.css";
import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

const PREFIX = "jaykkumar01-ft-web-ios-android-";
const RANDOM_ID = Math.floor(100000 + Math.random() * 900000); // 6-digit numeric

let conn = null;

const PeerConnect = ({ pushLog }) => {
    const peerRef = useRef(null);
    const [targetId, setTargetId] = useState("");
    const [myId, setMyId] = useState(RANDOM_ID);

    // Utility to log both to console and bottom log
    const log = (msg) => {
        console.log(msg);
        if (pushLog) pushLog(msg);
    };

    useEffect(() => {
        const peerId = PREFIX + RANDOM_ID;
        const peer = new Peer(peerId); // free PeerJS server
        peerRef.current = peer;

        log(`My ID is: ${RANDOM_ID}`);

        // Incoming connection handler
        peer.on("connection", (incomingConn) => {
            const incomingPeerId = incomingConn.peer.replace(PREFIX, "");
            log(`Incoming connection from: ${incomingPeerId}`);
            setupConnection(incomingConn);
        });

        peer.on("disconnected", () => log("Disconnected from peer."));
        peer.on("close", () => log("Peer closed."));

        // Clean up
        return () => peer.destroy();
    }, []);

    const setupConnection = (connection) => {
        conn = connection;

        conn.on("open", () => {
            const remoteId = conn.peer.replace(PREFIX, "");
            log(`Connected to ${remoteId}`);
        });

        conn.on("data", (data) => log(`Received data: ${JSON.stringify(data)}`));
        conn.on("close", () => log("Data connection closed."));
        conn.on("error", (err) => log(`Data connection error: ${err}`));
    };

    const handleConnect = () => {
        if (!targetId) return;
        const peer = peerRef.current;
        if (!peer) return;

        const connection = peer.connect(PREFIX + targetId, { reliable: true });
        log(`Trying to connect with ID: ${targetId}`);

        // Use same setup function
        setupConnection(connection);
    };

    return (
        <div className="PeerConnect">
            <p>Your ID: <b>{myId}</b></p>
            <input
                type="tel"            // important: ensures numeric keyboard on iOS & Android
                pattern="[0-9]*"      // hints only digits are allowed (iOS Safari)
                inputMode="numeric"    // hints browser for numeric keypad
                placeholder="Enter peer ID"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
            />

            <button onClick={handleConnect}>Connect</button>
        </div>
    );

};

export function getConnection() {
    return conn;
}

export default PeerConnect;
