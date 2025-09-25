import { useContext, useRef, useState, useEffect } from "react";
import { LogContext } from "../contexts/LogContext";

export function useWakeLock() {
    const { pushLog } = useContext(LogContext);
    const wakeLockRef = useRef(null);
    const isAcquiringRef = useRef(false);
    const [wakeLockActive, setWakeLockActive] = useState(false);

    const acquireLock = async () => {
        if (!("wakeLock" in navigator)) {
            pushLog?.("WakeLock unsupported");
            return false;
        }

        if (wakeLockRef.current || isAcquiringRef.current) return true;

        isAcquiringRef.current = true;
        try {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
            pushLog?.("WakeLock acquired");
            setWakeLockActive(true);

            wakeLockRef.current.addEventListener("release", () => {
                wakeLockRef.current = null;
                pushLog?.("WakeLock released");
                setWakeLockActive(false);
            });

            return true;
        } catch (err) {
            wakeLockRef.current = null;
            pushLog?.(`WakeLock error: ${err.message || err}`);
            setWakeLockActive(false);
            return false;
        } finally {
            isAcquiringRef.current = false;
        }
    };

    const releaseLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
            } catch (err) {
                pushLog?.(`Release error: ${err.message || err}`);
            } finally {
                wakeLockRef.current = null;
                setWakeLockActive(false);
            }
        }
    };

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === "visible" && wakeLockRef.current === null) {
                // Reacquire if previously acquired
                await acquireLock();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    return { wakeLockActive, requestUserWakeLock: acquireLock, releaseLock };
}
