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
    const [isPeerReady, setIsPeerReady] = useState(false); // ⬅️ NEW state for loading

    const log = (msg) => {
        console.log(msg);
        pushLog && pushLog(msg);
    };

    useEffect(() => {
        const peer = new Peer(PREFIX + peerId);
        peerRef.current = peer;

        peer.on("open", (id) => {
            log(`Peer opened with ID: ${id.replace(PREFIX, "")}`);
            setIsPeerReady(true); // ✅ Peer is ready now
        });

        peer.on("connection", (incomingConn) => {
            const incomingPeerId = incomingConn.peer.replace(PREFIX, "");
            log(`Incoming connection from: ${incomingPeerId}`);
            setupConnection(incomingConn);
        });

        peer.on("disconnected", () => log("Disconnected from peer."));
        peer.on("close", () => log("Peer closed."));

        return () => peer.destroy();
    }, []);

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

    return (
        <PeerContext.Provider
            value={{
                peer: peerRef.current,
                peerId,
                connection,
                connectToPeer,
                isPeerReady, // ⬅️ Expose to consumers
            }}
        >
            {children}
        </PeerContext.Provider>
    );
};

export const usePeer = () => useContext(PeerContext);
