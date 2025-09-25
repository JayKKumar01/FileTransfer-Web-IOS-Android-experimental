import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TabBar.css";
import { FileContext } from "../contexts/FileContext";

const TabBar = () => {
    const [activeTab, setActiveTab] = useState("SEND");
    const navigate = useNavigate();
    const { files } = useContext(FileContext); // access context

    const handleTabClick = (tab) => {
        setActiveTab(tab);

        if (tab === "SEND") {
            // navigate to /files if context is empty
            navigate(files.length === 0 ? "/files" : "/send");
        }

        if (tab === "RECEIVE") {
            navigate("/receive");
        }
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
