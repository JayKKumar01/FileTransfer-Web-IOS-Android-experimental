import React, { useState } from "react";
import "./App.css";
import PeerConnect from "./components/PeerConnect";

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

            <main className="App-content">
                <PeerConnect pushLog={pushLog} />
            </main>

            <footer className="App-footer">
        <textarea
            readOnly
            className="App-log"
            value={logMessages.join("\n")}
            placeholder="Logs will appear here..."
        />
            </footer>
        </div>
    );
}

export default App;
