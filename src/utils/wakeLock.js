import { useContext, useEffect, useRef, useState } from "react";
import { LogContext } from "../contexts/LogContext";

export function useWakeLock() {
    const { pushLog } = useContext(LogContext);
    const wakeLockRef = useRef(null);
    const retryIntervalRef = useRef(null);
    const isAcquiringRef = useRef(false);
    const [wakeLockActive, setWakeLockActive] = useState(false);

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    const acquireLock = async (fromUserInteraction = false) => {
        if (!("wakeLock" in navigator)) {
            pushLog && pushLog("WakeLock unsupported");
            return false;
        }
        if (wakeLockRef.current || isAcquiringRef.current) return true;

        // On iOS, must be user interaction
        if (isIOS && !fromUserInteraction) return false;

        isAcquiringRef.current = true;
        try {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
            pushLog && pushLog("WakeLock acquired");
            setWakeLockActive(true);

            wakeLockRef.current.addEventListener("release", () => {
                wakeLockRef.current = null;
                pushLog && pushLog("WakeLock released");
                setWakeLockActive(false);
            });

            return true;
        } catch (err) {
            wakeLockRef.current = null;
            pushLog && pushLog(`WakeLock error: ${err.message || err}`);
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
                pushLog && pushLog(`Release error: ${err.message || err}`);
            } finally {
                wakeLockRef.current = null;
                setWakeLockActive(false);
            }
        }
    };

    useEffect(() => {
        let isUnmounted = false;

        const handleVisibilityChange = async () => {
            if (document.visibilityState === "visible" && !wakeLockRef.current) {
                const success = await acquireLock(isIOS); // for iOS require user click
                if (success && !isUnmounted) pushLog && pushLog("WakeLock reacquired (visibility change)");
            }
        };

        // Try auto acquire for non-iOS
        if (!isIOS) acquireLock();

        document.addEventListener("visibilitychange", handleVisibilityChange);

        if (!retryIntervalRef.current) {
            retryIntervalRef.current = setInterval(async () => {
                if (!wakeLockRef.current) {
                    await acquireLock(isIOS); // iOS requires user interaction
                }
            }, 5000);
        }

        return () => {
            isUnmounted = true;
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            releaseLock();
            if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
            }
        };
    }, [pushLog]);

    return { wakeLockActive, requestUserWakeLock: () => acquireLock(true), isIOS };
}
