import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { LogContext } from "./LogContext";
import {isAndroid, isApple} from "../utils/osUtil";

const PREFIX = "jaykkumar01-ft-web-ios-android-";
const RANDOM_ID = Math.floor(100000 + Math.random() * 900000);

const PeerContext = createContext(null);

export const PeerProvider = ({ children }) => {
    const { pushLog } = useContext(LogContext);

    const [peerId] = useState(RANDOM_ID);
    const [remoteId, setRemoteId] = useState(null);
    const [connection, setConnection] = useState(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    const [isConnectionReady, setIsConnectionReady] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("idle"); // idle | connecting | connected | retrying
    const [peerDevice, setPeerDevice] = useState(null);

    const refs = useRef({
        peer: null,
        conn: null,
        pendingTarget: null, // target peer we are trying to connect
        lastConnectedPeerId: null, // last successfully connected peer
        retryCount: 0
    });

    const log = (msg) => {
        console.log(msg);
        pushLog?.(msg);
    };

    const cleanupConnection = () => {
        if (refs.current.conn) {
            try { refs.current.conn.close(); } catch {}
            refs.current.conn = null;
        }
        setConnection(null);
        setRemoteId(null);
        setIsConnectionReady(false);
        setConnectionStatus("idle");
    };

    const setupConnection = (conn) => {
        cleanupConnection();

        refs.current.conn = conn;
        setConnection(conn);
        setIsConnectionReady(false);
        setConnectionStatus("connecting");

        conn.on("open", () => {
            conn.send({
                type: "deviceInfo",
                device: isApple() ? "iOS" : isAndroid() ? "Android" : "unknown",
            });
            const rid = conn.peer.replace(PREFIX, "");
            log(`Connected to ${rid}`);
            setRemoteId(rid);
            setIsConnectionReady(true);
            setConnectionStatus("connected");
            refs.current.pendingTarget = null;
            refs.current.lastConnectedPeerId = rid;
            refs.current.retryCount = 0;
        });

        conn.on("data", (data) => {
            if (data.type === "deviceInfo") {
                setPeerDevice(data.device);
                log(`Received device info: ${data.device}`);
            }
        })

        conn.on("close", () => {
            log("Connection closed");
            cleanupConnection();
        });

        conn.on("error", (err) => {
            log(`Connection error: ${err}`);
            cleanupConnection();
        });
    };

    const initializePeer = () => {
        if (refs.current.peer) return;

        const peer = new Peer(PREFIX + peerId);
        refs.current.peer = peer;

        peer.on("open", (id) => {
            log(`Peer opened: ${id.replace(PREFIX, "")}`);
            setIsPeerReady(true);

            // After peer-level reconnect, try to reconnect last peer if it existed
            const lastPeer = refs.current.lastConnectedPeerId;
            if (lastPeer) {
                log(`Reconnecting to last connected peer ${lastPeer}...`);
                connectToPeer(lastPeer);
            }
        });

        peer.on("connection", (incomingConn) => {
            const incomingPeerId = incomingConn.peer.replace(PREFIX, "");
            log(`Incoming connection from: ${incomingPeerId}`);
            setupConnection(incomingConn);
        });

        peer.on("disconnected", () => {
            log("Peer disconnected");
            setIsPeerReady(false);
            cleanupConnection();
            peer.reconnect();
        });

        peer.on("close", () => log("Peer closed – please refresh."));

        peer.on("error", (err) => {
            log(`Peer error: ${err.type || err}`);
            const targetId = refs.current.pendingTarget;

            // Retry logic for peer-unavailable
            if (err?.type === "peer-unavailable" && targetId) {
                if (refs.current.retryCount < 5) {
                    refs.current.retryCount++;
                    setConnectionStatus("retrying");
                    log(`Peer unavailable. Retrying ${refs.current.retryCount}/5 in 4s...`);
                    setTimeout(() => {
                        const conn = peer.connect(PREFIX + targetId, { reliable: true });
                        setupConnection(conn);
                    }, 4000);
                } else {
                    log("Max retries reached. Could not connect to peer.");
                    refs.current.pendingTarget = null;
                    refs.current.retryCount = 0;
                    setConnectionStatus("idle");
                }
            }
        });
    };

    const connectToPeer = (targetId) => {
        if (!targetId || !refs.current.peer) return;

        log(`Connecting to ${targetId}`);
        refs.current.pendingTarget = targetId;
        refs.current.retryCount = 0;

        const conn = refs.current.peer.connect(PREFIX + targetId, { reliable: true });
        setupConnection(conn);
    };

    const reconnect = () => {
        const peer = refs.current.peer;
        if (!peer) return log("No peer to reconnect.");

        if (peer.disconnected) {
            log("Peer disconnected – reconnecting...");
            peer.reconnect();
        } else {
            log("Peer active – no reconnect needed.");
        }
    };

    useEffect(() => {
        return () => {
            cleanupConnection();
            refs.current.peer?.destroy();
        };
    }, []);

    return (
        <PeerContext.Provider
            value={{
                peerId,
                remoteId,
                connection,
                isPeerReady,
                isConnectionReady,
                connectionStatus,
                initializePeer,
                connectToPeer,
                reconnect,
                peerDevice,
            }}
        >
            {children}
        </PeerContext.Provider>
    );
};

export const usePeer = () => useContext(PeerContext);
