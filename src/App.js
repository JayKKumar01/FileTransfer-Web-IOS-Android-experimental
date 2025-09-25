import React, { useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import PeerConnect from "./components/PeerConnect";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";
import { preventPinchZoom, setVisibleHeight } from "./utils/osUtil";
import { usePeer } from "./contexts/PeerContext";

function App() {
    const { logMessages, pushLog } = useContext(LogContext);
    const logRef = useRef(null);
    const { wakeLockActive, requestUserWakeLock } = useWakeLock();
    const [buttonClicked, setButtonClicked] = useState(false);

    const { initializePeer } = usePeer();

    // ✅ Handle visible height on portrait mode
    useEffect(() => {
        const updateHeight = () => setVisibleHeight(pushLog);
        updateHeight();
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, [pushLog]);

    // ✅ Enable pinch/zoom prevention on all devices
    useEffect(() => {
        const cleanup = preventPinchZoom(pushLog);
        return () => cleanup?.();
    }, []);

    // Scroll to bottom whenever logMessages change
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logMessages]);

    // Handler for wake lock / initialization button
    const handleButtonClick = async () => {
        await requestUserWakeLock(); // safe on all devices
        setButtonClicked(true);
        initializePeer(); // initialize peer after user action
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>FileTransfer-Web-IOS-Android</h1>
            </header>

            <main className="App-content">
                {!buttonClicked ? (
                    <button className="App-init-button" onClick={handleButtonClick}>
                        {wakeLockActive ? "Initialize Connection" : "Keep Screen Awake & Initialize"}
                    </button>
                ) : (
                    <PeerConnect />
                )}
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
