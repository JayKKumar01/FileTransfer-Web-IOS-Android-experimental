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
    const [remoteId, setRemoteId] = useState(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    const [isConnectionReady, setIsConnectionReady] = useState(false);
    const isConnectionReadyRef = useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        isConnectionReadyRef.current = isConnectionReady;
    }, [isConnectionReady]);

    const log = (msg) => {
        console.log(msg);
        pushLog?.(msg);
    };

    // ❌ Removed automatic useEffect initialization
    const initializePeer = () => {
        if (peerRef.current) return; // prevent double initialization

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

        peer.on("disconnected", () => {
            log("Peer disconnected..." + isConnectionReadyRef.current);
            setIsPeerReady(false);
            if (isConnectionReadyRef.current) {
                setConnection(null);
                setRemoteId(null);
                setIsConnectionReady(false);
            } else {
                peerRef.current.reconnect();
            }
        });

        peer.on("close", () => log("Peer closed – please refresh the homepage to reconnect."));
        peer.on("error", (err) => log(`Peer error: ${err}`));
    };

    const setupConnection = (conn) => {
        setConnection(conn);
        setIsConnectionReady(false);
        conn.on("open", () => {
            const rid = conn.peer.replace(PREFIX, "");
            log(`Connected to ${rid}`);
            setRemoteId(rid);
            setIsConnectionReady(true);
        });
        conn.on("close", () => log("Data connection closed."));
        conn.on("error", (err) => log(`Data connection error: ${err}`));
    };

    const connectToPeer = (targetId, callback) => {
        if (!targetId || !peerRef.current) return;

        log(`Trying to connect with ID: ${targetId}`);
        const retryInterval = 4;
        const maxRetries = 20 / retryInterval;
        let attempts = 0;
        let connRef = null;

        const attemptConnection = () => {
            if (!peerRef.current || peerRef.current.destroyed) {
                log("Cannot connect – peer is destroyed.");
                callback?.("failed");
                return;
            }

            connRef?.close();
            connRef = peerRef.current.connect(PREFIX + targetId, { reliable: true });
            setupConnection(connRef);

            setTimeout(() => {
                if (!connRef?.open) {
                    attempts++;
                    if (attempts < maxRetries) {
                        callback?.(`Retrying... (${attempts}/${maxRetries})`);
                        setTimeout(attemptConnection, retryInterval * 1000);
                    } else {
                        log(`Failed to connect to ${targetId}`);
                        callback?.("failed");
                    }
                }
            }, retryInterval * 1000);
        };

        attemptConnection();
    };

    const reconnect = () => {
        if (!peerRef.current || peerRef.current.destroyed) {
            log("Peer destroyed – please refresh the homepage to reconnect.");
        } else if (peerRef.current.disconnected) {
            log("Peer disconnected – attempting to reconnect...");
            peerRef.current.reconnect();
        } else {
            log("Peer active – no reconnect needed.");
        }
    };

    return (
        <PeerContext.Provider
            value={{
                peer: peerRef.current,
                peerId,
                connection,
                remoteId,
                isConnectionReady,
                isPeerReady,
                initializePeer, // 🔹 expose initializePeer to call from App.js
                connectToPeer,
                reconnect,
            }}
        >
            {children}
        </PeerContext.Provider>
    );
};

export const usePeer = () => useContext(PeerContext);
