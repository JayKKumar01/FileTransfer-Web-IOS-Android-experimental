import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TabBar.css";
import { FileContext } from "../contexts/FileContext";
import { TabContext } from "../contexts/TabContext";
import { usePeer } from "../contexts/PeerContext"; // ✅ access connection state

const TabBar = () => {
    const { activeTab, setActiveTab } = useContext(TabContext);
    const { files } = useContext(FileContext);
    const { isConnectionReady } = usePeer(); // ✅ wait for connection
    const navigate = useNavigate();

    useEffect(() => {
        if (!isConnectionReady) return; // only navigate after connection is ready

        if (activeTab === "SEND") {
            navigate(files.length === 0 ? "/files" : "/send");
        }
        if (activeTab === "RECEIVE") {
            navigate("/receive");
        }
    }, [activeTab, isConnectionReady]);

    return (
        <div className="TabBar">
            <button
                className={`TabButton left ${activeTab === "SEND" ? "active" : ""}`}
                onClick={() => setActiveTab("SEND")}
            >
                SEND
            </button>
            <button
                className={`TabButton right ${activeTab === "RECEIVE" ? "active" : ""}`}
                onClick={() => setActiveTab("RECEIVE")}
            >
                RECEIVE
            </button>
        </div>
    );
};

export default TabBar;
