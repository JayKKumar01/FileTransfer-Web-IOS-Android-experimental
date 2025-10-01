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
import FileChunkTest from "./old/FileChunkTest";
import FileSenderTest from "./old/FileSenderTest"; // ✅ test component

// import {deleteDatabase} from "./utils/chunkUtil";
import FileChunkReader from "./old/FileChunkReader";
import AndroidChunkSpeedTest from "./old/AndroidChunkSpeedTest";
import PeerFileBenchmark from "./old/PeerFileBenchmark";
import IndexedDBFileHandler from "./old/IndexedDBFileHandler";
import FileStreamSaver from "./old/FileStreamSaver";
import FakeDownload from "./components/FakeDownload"; // import your delete function
//
// // ✅ Delete DB immediately at app start
// deleteDatabase()
//     .then(() => console.log("✅ IndexedDB cleared."))
//     .catch((err) => console.error("❌ Failed to clear DB:", err));

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


//if one file then download that directly using url object, if multiple then zip, if android then mulitple downloads
//all using the database, clear the db at end, but keep clearing as the files are added to zip for ios or downlaoded for android
//reconnect, even when connection is closed, mark who entered targetId to connect
// download does not start instantly so for non ios, use streamsaver api
// check if conn.send is slow on android for 256 kb, or not, check ios only to get result
