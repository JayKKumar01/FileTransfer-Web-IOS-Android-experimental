import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TabBar.css";

const TabBar = () => {
    const [activeTab, setActiveTab] = useState("SEND");
    const navigate = useNavigate();

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        if (tab === "SEND") navigate("/files");
        if (tab === "RECEIVE") navigate("/share");
    };

    return (
        <div className="TabBar">
            <button
                className={`TabButton left ${activeTab === "SEND" ? "active" : ""}`}
                onClick={() => handleTabClick("SEND")}
            >
                SEND
            </button>
            <button
                className={`TabButton right ${activeTab === "RECEIVE" ? "active" : ""}`}
                onClick={() => handleTabClick("RECEIVE")}
            >
                RECEIVE
            </button>
        </div>
    );
};

export default TabBar;
