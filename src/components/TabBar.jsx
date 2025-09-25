import React, { useState } from "react";
import "../styles/TabBar.css";

const TabBar = ({ onTabChange }) => {
    const [activeTab, setActiveTab] = useState("SEND");

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        if (onTabChange) onTabChange(tab);
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
