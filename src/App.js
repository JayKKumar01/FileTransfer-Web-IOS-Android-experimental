import React, { useContext, useEffect, useRef } from "react";
import "./App.css";
import PeerConnect from "./components/PeerConnect";
import { LogContext } from "./contexts/LogContext";
import { requestWakeLock, releaseWakeLock } from "./utils/wakeLock";

function App() {
    const { logMessages, pushLog } = useContext(LogContext);
    const logRef = useRef(null);

    // Scroll to the bottom whenever logMessages change
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logMessages]);

    useEffect(() => {
        // Request wake lock when the component mounts
        requestWakeLock(({ status, error }) => {
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
                <PeerConnect />
            </main>

            <footer className="App-footer">
                <textarea
                    ref={logRef}
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
