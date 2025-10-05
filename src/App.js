import React, { useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import PeerConnect from "./components/PeerConnect";
import FileInput from "./components/FileInput";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";
import { isApple, preventPinchZoom, setVisibleHeight } from "./utils/osUtil";
import { usePeer } from "./contexts/PeerContext";
import TabBar from "./components/TabBar";
import SendFiles from "./components/SendFiles";
import ReceiveFiles from "./components/ReceiveFiles";

function App() {
    const { logMessages, pushLog } = useContext(LogContext);
    const logRef = useRef(null);
    const { requestUserWakeLock } = useWakeLock();
    const { initializePeer } = usePeer();
    const navigate = useNavigate();
    const location = useLocation();
    const [initialized, setInitialized] = useState(false);
    const [pendingRemoteId, setPendingRemoteId] = useState(null); // store remoteId until user clicks
    const { isConnectionLost } = usePeer();

    // Log platform
    useEffect(() => {
        pushLog(isApple() ? "Running on iOS" : "Running on non-iOS");
    }, [pushLog]);

    // Detect remoteId from URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const remoteId = params.get("remoteId");

        if (remoteId) {
            pushLog(`Remote ID found in URL: ${remoteId}`);
            setPendingRemoteId(remoteId); // save for later use
        }
    }, [location.search, pushLog]);

    // Handle viewport height
    useEffect(() => {
        const updateHeight = () => setVisibleHeight(pushLog);
        updateHeight();
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, [pushLog]);

    // Prevent pinch zoom
    useEffect(() => preventPinchZoom(pushLog), []);

    // Scroll logs to bottom
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logMessages]);

    // Keep screen awake & initialize peer
    const handleButtonClick = async () => {
        await requestUserWakeLock();
        initializePeer();
        setInitialized(true);

        // Navigate to /connect with remoteId if present
        if (pendingRemoteId) {
            navigate(`/connect?remoteId=${pendingRemoteId}`);
        } else {
            navigate("/connect");
        }
    };

    // Routes where TabBar should be shown
    const tabBarRoutes = ["/files", "/send", "/receive"];
    const showTabBar = initialized && tabBarRoutes.includes(location.pathname);

    return (
        <div className="App">
            <header className="App-header">
                <h1>FileTransfer-Web-IOS-Android</h1>
            </header>

            {isConnectionLost && (
                <div className="app-connection-lost">
                    Connection lost — {isApple() && "please save your received files and "}start a new session.
                </div>
            )}



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
                            <Route path="*" element={<PeerConnect />} />
                        </Routes>
                    </>
                )}
            </main>

            {showTabBar && <TabBar />}

            {/*<footer className="App-footer">*/}
            {/*    <textarea*/}
            {/*        ref={logRef}*/}
            {/*        readOnly*/}
            {/*        className="App-log"*/}
            {/*        value={logMessages.join("\n")}*/}
            {/*        placeholder="Logs will appear here..."*/}
            {/*    />*/}
            {/*</footer>*/}
        </div>
    );
}

export default App;
