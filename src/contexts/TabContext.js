// src/contexts/TabContext.js
import React, { createContext, useState } from "react";

export const TabContext = createContext({
    activeTab: "SEND",
    setActiveTab: () => {},
});

export const TabProvider = ({ children }) => {
    const [activeTab, setActiveTab] = useState("SEND");

    return (
        <TabContext.Provider value={{ activeTab, setActiveTab }}>
            {children}
        </TabContext.Provider>
    );
};
