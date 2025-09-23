import React, { useState } from "react";
import PeerConnect from "./components/PeerConnect";
import "./App.css";

function App() {
    const [logMessages, setLogMessages] = useState([]);

    const pushLog = (msg) => {
        setLogMessages((prev) => [...prev, msg].slice(-10));
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>FileTransfer-Web-IOS-Android</h1>
            </header>

            <div className="App-content">
                <PeerConnect pushLog={pushLog} />
            </div>

            {/* Bottom log as static footer */}
            <div className="App-log">

            </div>
        </div>
    );
}

export default App;
