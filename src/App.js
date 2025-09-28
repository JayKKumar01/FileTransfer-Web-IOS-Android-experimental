import React, { useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import PeerConnect from "./components/PeerConnect";
import FileInput from "./components/FileInput";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";
import { preventPinchZoom, setVisibleHeight } from "./utils/osUtil";
import { usePeer } from "./contexts/PeerContext";
import TabBar from "./components/TabBar";
import SendFiles from "./components/SendFiles";
import ReceiveFiles from "./components/ReceiveFiles";
import FileChunkTest from "./components/FileChunkTest";
import FileSenderTest from "./components/FileSenderTest"; // ✅ test component

import {deleteDatabase} from "./utils/chunkUtil";
import FileChunkReader from "./components/FileChunkReader";
import AndroidChunkSpeedTest from "./components/AndroidChunkSpeedTest"; // import your delete function

// ✅ Delete DB immediately at app start
deleteDatabase()
    .then(() => console.log("✅ IndexedDB cleared."))
    .catch((err) => console.error("❌ Failed to clear DB:", err));

function App() {
    const { logMessages, pushLog } = useContext(LogContext);
    const logRef = useRef(null);
    const { requestUserWakeLock } = useWakeLock();
    const { initializePeer } = usePeer();
    const navigate = useNavigate();
    const location = useLocation();
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

    const handleTestClick = () => {
        navigate("/test-chunk");
    };

    // Routes where TabBar should be shown
    const tabBarRoutes = ["/files", "/send", "/receive"];
    const showTabBar = initialized && tabBarRoutes.includes(location.pathname);

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
                    <>
                        <Routes>
                            <Route path="/connect" element={<PeerConnect />} />
                            <Route path="/files" element={<FileInput />} />
                            <Route path="/send" element={<SendFiles />} />
                            <Route path="/receive" element={<ReceiveFiles />} />
                            <Route path="/test-chunk" element={<FileSenderTest />} /> {/* ✅ new test route */}
                            <Route path="*" element={<PeerConnect />} />
                        </Routes>

                        <div style={{ marginTop: "15px", textAlign: "center" }}>
                            <button onClick={handleTestClick}>
                                Test File Chunking & IndexedDB
                            </button>
                        </div>
                    </>
                )}
            </main>

            {showTabBar && <TabBar />}

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
