import React, { createContext, useEffect, useRef, useState, useContext } from "react";
import Peer from "peerjs";
import { LogContext } from "./LogContext";

const PREFIX = "jaykkumar01-ft-web-ios-android-";
const RANDOM_ID = Math.floor(100000 + Math.random() * 900000); // 6-digit numeric

const PeerContext = createContext(null);

export const PeerProvider = ({ children }) => {
    const { pushLog } = useContext(LogContext);
    const peerRef = useRef(null);
    const [peerId] = useState(RANDOM_ID);
    const [connection, setConnection] = useState(null);
    const [isPeerReady, setIsPeerReady] = useState(false);

    const log = (msg) => {
        console.log(msg);
        pushLog && pushLog(msg);
    };

    const initializePeer = () => {
        const peer = new Peer(PREFIX + peerId);
        peerRef.current = peer;

        peer.on("open", (id) => {
            log(`Peer opened with ID: ${id.replace(PREFIX, "")}`);
            setIsPeerReady(true);
        });

        peer.on("connection", (incomingConn) => {
            const incomingPeerId = incomingConn.peer.replace(PREFIX, "");
            log(`Incoming connection from: ${incomingPeerId}`);
            setupConnection(incomingConn);
        });

        // ✅ Only reconnect on actual disconnect
        peer.on("disconnected", () => {
            log("Peer disconnected...");
            setIsPeerReady(false);
        });

        peer.on("close", () => log("Peer closed – please refresh the homepage to reconnect."));
        peer.on("error", (err) => log(`Peer error: ${err}`));
    };

    useEffect(() => {
        initializePeer();
        return () => peerRef.current?.destroy();
    }, [peerId]);

    const setupConnection = (conn) => {
        setConnection(conn);

        conn.on("open", () => {
            const remoteId = conn.peer.replace(PREFIX, "");
            log(`Connected to ${remoteId}`);
        });

        conn.on("data", (data) => log(`Received data: ${JSON.stringify(data)}`));
        conn.on("close", () => log("Data connection closed."));
        conn.on("error", (err) => log(`Data connection error: ${err}`));
    };

    const connectToPeer = (targetId) => {
        if (!targetId || !peerRef.current) return;
        log(`Trying to connect with ID: ${targetId}`);
        const conn = peerRef.current.connect(PREFIX + targetId, { reliable: true });
        setupConnection(conn);
    };

    // Expose reconnect method to App.js if needed
    const reconnect = () => {
        if (!peerRef.current || peerRef.current.destroyed) {
            log("Peer is destroyed – please refresh the homepage to reconnect.");
        } else if (peerRef.current.disconnected) {
            log("Peer disconnected – attempting to reconnect...");
            peerRef.current.reconnect();
        } else {
            log("Peer is active – no reconnect needed.");
        }
    };

    return (
        <PeerContext.Provider
            value={{
                peer: peerRef.current,
                peerId,
                connection,
                connectToPeer,
                reconnect,
                isPeerReady,
            }}
        >
            {children}
        </PeerContext.Provider>
    );
};

export const usePeer = () => useContext(PeerContext);
