import { useContext, useEffect, useRef } from "react";
import { LogContext } from "../contexts/LogContext";

export function useWakeLock() {
    const { pushLog } = useContext(LogContext);
    const wakeLockRef = useRef(null);
    const retryIntervalRef = useRef(null);
    const isAcquiringRef = useRef(false);

    useEffect(() => {
        let isUnmounted = false;

        const acquireLock = async () => {
            if (!("wakeLock" in navigator)) {
                if (!isUnmounted) pushLog && pushLog("WakeLock unsupported");
                return;
            }
            if (wakeLockRef.current || isAcquiringRef.current) return;

            isAcquiringRef.current = true;
            try {
                wakeLockRef.current = await navigator.wakeLock.request("screen");
                if (!isUnmounted) pushLog && pushLog("WakeLock acquired");

                wakeLockRef.current.addEventListener("release", () => {
                    wakeLockRef.current = null;
                    if (!isUnmounted) pushLog && pushLog("WakeLock released");
                });
            } catch (err) {
                wakeLockRef.current = null;
                if (!isUnmounted) pushLog && pushLog(`WakeLock error: ${err.message || err}`);
            } finally {
                isAcquiringRef.current = false;
            }
        };

        const handleVisibilityChange = async () => {
            if (document.visibilityState === "visible") {
                await acquireLock();
                if (!isUnmounted) pushLog && pushLog("WakeLock reacquired (visibility change)");
            }
        };

        acquireLock();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        if (!retryIntervalRef.current) {
            retryIntervalRef.current = setInterval(async () => {
                if (!wakeLockRef.current) {
                    await acquireLock();
                    if (!isUnmounted) pushLog && pushLog("WakeLock reacquired (retry)");
                }
            }, 5000);
        }

        return () => {
            isUnmounted = true;
            document.removeEventListener("visibilitychange", handleVisibilityChange);

            if (wakeLockRef.current) {
                wakeLockRef.current.release().finally(() => {
                    wakeLockRef.current = null;
                    // No pushLog here to avoid infinite re-renders
                });
            }

            if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
            }
        };
    }, [pushLog]);
}
