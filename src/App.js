import React, { useState, useEffect } from "react";
import "./App.css";
import PeerConnect from "./components/PeerConnect";
import { requestWakeLock, releaseWakeLock } from "./utils/wakeLock";

function App() {
    const [logMessages, setLogMessages] = useState([]);
    const [wakeStatus, setWakeStatus] = useState(null);

    const pushLog = (msg) => {
        setLogMessages((prev) => [...prev, msg].slice(-10));
    };

    useEffect(() => {
        // Request wake lock when the component mounts
        requestWakeLock(({ status, error }) => {
            setWakeStatus(status);
            if (error) pushLog(`WakeLock error: ${error.message || error}`);
            else pushLog(`WakeLock status: ${status}`);
        });

        // Release wake lock on unmount
        return () => {
            releaseWakeLock(({ status, error }) => {
                if (error) pushLog(`WakeLock release error: ${error.message || error}`);
                else pushLog(`WakeLock released: ${status}`);
            });
        };
    }, []);

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
                    value={[...logMessages, `Screen Wake Status: ${wakeStatus}`].join("\n")}
                    placeholder="Logs will appear here..."
                />
            </footer>
        </div>
    );
}

export default App;
