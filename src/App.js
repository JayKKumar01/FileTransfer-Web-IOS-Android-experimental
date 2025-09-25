import React, { useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import { Routes, Route, useNavigate } from "react-router-dom";
import PeerConnect from "./components/PeerConnect";
import FileInput from "./components/FileInput";
import ShareFiles from "./components/ShareFiles";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";
import { preventPinchZoom, setVisibleHeight } from "./utils/osUtil";
import { usePeer } from "./contexts/PeerContext";

function App() {
    const { logMessages, pushLog } = useContext(LogContext);
    const logRef = useRef(null);
    const { requestUserWakeLock } = useWakeLock();
    const { initializePeer } = usePeer();
    const navigate = useNavigate();
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const updateHeight = () => setVisibleHeight(pushLog);
        updateHeight();
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, [pushLog]);

    useEffect(() => preventPinchZoom(pushLog), []);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logMessages]);

    const handleButtonClick = async () => {
        await requestUserWakeLock();
        initializePeer();
        setInitialized(true);
        navigate("/connect");
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>FileTransfer-Web-IOS-Android</h1>
            </header>

            <main className="App-content">
                {!initialized ? (
                    <button className="App-init-button" onClick={handleButtonClick}>
                        Keep Screen Awake & Initialize
                    </button>
                ) : (
                    <Routes>
                        <Route path="/connect" element={<PeerConnect />} />
                        <Route path="/files" element={<FileInput />} />
                        <Route path="/share" element={<ShareFiles />} />
                        <Route path="*" element={<PeerConnect />} />
                    </Routes>
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
