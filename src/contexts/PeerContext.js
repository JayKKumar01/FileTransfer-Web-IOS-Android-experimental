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
    const [remoteId, setRemoteId] = useState(null); // new state
    const [isPeerReady, setIsPeerReady] = useState(false);
    const [isConnectionReady, setIsConnectionReady] = useState(false); // new state

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
            peerRef.current.reconnect();
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
        setIsConnectionReady(false); // reset until open

        conn.on("open", () => {
            const remoteId = conn.peer.replace(PREFIX, "");
            log(`Connected to ${remoteId}`);
            setRemoteId(remoteId); // store remote peer ID
            setIsConnectionReady(true); // mark connection as ready
        });

        conn.on("data", (data) => log(`Received data: ${JSON.stringify(data)}`));
        conn.on("close", () => log("Data connection closed."));
        conn.on("error", (err) => log(`Data connection error: ${err}`));
    };

    const connectToPeer = (targetId, callback) => {
        if (!targetId || !peerRef.current) return;

        log(`Trying to connect with ID: ${targetId}`);

        const maxRetries = 3;
        const retryInterval = 2000;
        let attempts = 0;
        let connRef = null;

        const attemptConnection = () => {
            if (!peerRef.current || peerRef.current.destroyed) {
                log("Cannot connect – peer is destroyed.");
                callback?.("failed");
                return;
            }

            // Close stale connection
            connRef?.close();

            // Create new connection
            connRef = peerRef.current.connect(PREFIX + targetId, { reliable: true });

            setupConnection(connRef);

            // Wait 2 seconds and check if connection is open
            setTimeout(() => {
                if (!connRef?.open) {
                    attempts++;
                    if (attempts < maxRetries) {
                        callback?.(`Retrying... (${attempts}/${maxRetries})`);
                        setTimeout(attemptConnection, retryInterval);
                    } else {
                        log(`Failed to connect to ${targetId} – peer may be unavailable or ID invalid.`);
                        callback?.("failed");
                    }
                }
                // Do nothing if connRef.open is true
            }, 2000);
        };

        attemptConnection();
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
                remoteId, // expose remoteId
                isConnectionReady, // expose new state
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
