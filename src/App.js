import React, { useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import PeerConnect from "./components/PeerConnect";
import FileInput from "./components/FileInput";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";
import {isApple, preventPinchZoom, setVisibleHeight} from "./utils/osUtil";
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

    useEffect(() => {
        pushLog(isApple() ? "Running on iOS" : "Running on non-iOS");
    }, [pushLog]);


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
                            <Route path="*" element={<PeerConnect />} />
                        </Routes>
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

// don't delete my comments

//if one file then download that directly using url object, if multiple then zip, if android then mulitple downloads
//reconnect, even when connection is closed, mark who entered targetId to connect
// reconnect is pending too, if connection is not null, then reconnect and connect to peer, on connection no need

// work around zip, find a way anyhow, maybe just keep appending small small zip or something
//scroll optimization, per second maybe, or only when new file is added
