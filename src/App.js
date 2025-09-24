import React, { useContext, useEffect, useRef } from "react";
import "./App.css";
import PeerConnect from "./components/PeerConnect";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";

function App() {
    const { logMessages } = useContext(LogContext);
    const logRef = useRef(null);

    const { wakeLockActive, requestUserWakeLock, isIOS } = useWakeLock();

    // Scroll to bottom whenever logMessages change
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logMessages]);

    return (
        <div className="App">
            <header className="App-header">
                <h1>FileTransfer-Web-IOS-Android</h1>

                {/* Show button for iOS only if wake lock is not active */}
                {isIOS && !wakeLockActive && (
                    <button onClick={requestUserWakeLock}>
                        Keep Screen Awake (iOS)
                    </button>
                )}
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
