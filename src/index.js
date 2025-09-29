import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "./App";
import { LogProvider } from "./contexts/LogContext";
import { PeerProvider } from "./contexts/PeerContext";
import { FileProvider } from "./contexts/FileContext";
import reportWebVitals from "./reportWebVitals";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <HashRouter>
            <LogProvider>
                <PeerProvider>
                    <FileProvider>
                        <App />
                    </FileProvider>
                </PeerProvider>
            </LogProvider>
        </HashRouter>
    </React.StrictMode>
);

// For performance measuring, you can pass a function to log results
// Example: reportWebVitals(console.log)
reportWebVitals();
