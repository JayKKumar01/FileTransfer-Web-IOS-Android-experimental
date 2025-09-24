import React, { useContext, useEffect, useRef } from "react";
import "./App.css";
import PeerConnect from "./components/PeerConnect";
import { LogContext } from "./contexts/LogContext";
import { useWakeLock } from "./utils/wakeLock";
import { isIOS, preventPinchZoom, setVisibleHeight } from "./utils/osUtil";
import {usePeer} from "./contexts/PeerContext";


function App() {
    const { logMessages, pushLog } = useContext(LogContext);
    const logRef = useRef(null);
    const { wakeLockActive, requestUserWakeLock } = useWakeLock();
    const { reconnect } = usePeer(); // <-- destructure reconnect

    // ✅ Handle visible height on portrait mode
    useEffect(() => {
        const updateHeight = () => setVisibleHeight(pushLog);

        updateHeight();
        window.addEventListener("resize", updateHeight);

        return () => window.removeEventListener("resize", updateHeight);
    }, [pushLog]);

    // ✅ Enable iOS pinch/zoom prevention
    useEffect(() => {
        const cleanup = preventPinchZoom(pushLog);
        return () => cleanup?.();
    }, []);

    // // ✅ Reconnect peer when app comes back to foreground
    // useEffect(() => {
    //     const handleVisibilityChange = () => {
    //         if (document.visibilityState === "visible") {
    //             reconnect(); // <-- call reconnect on foreground
    //         }
    //     };
    //
    //     document.addEventListener("visibilitychange", handleVisibilityChange);
    //     return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // }, [reconnect]);

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
