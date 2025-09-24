// iOS utility functions
export const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * Prevent pinch/zoom on iOS
 */
export const preventPinchZoom = (logCallback) => {
    if (!isIOS()) return;

    const preventZoom = (e) => {
        if (e.touches.length > 1) e.preventDefault();
    };

    const preventGesture = (e) => e.preventDefault();

    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventGesture);

    logCallback?.("✋ iOS pinch/zoom prevention enabled");
    console.log("[iOSUtil] Pinch/zoom prevention enabled");

    return () => {
        document.removeEventListener('touchmove', preventZoom);
        document.removeEventListener('gesturestart', preventGesture);
    };
};

/**
 * Set visible height CSS variable based on viewport
 * Only applies in portrait mode
 */
export const setVisibleHeight = (logCallback) => {
    if (window.innerHeight >= window.innerWidth) {
        const vh = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${vh}px`);
        logCallback?.(`📏 App height updated: ${vh}px`);
        console.log(`[OSUtil] Visible height set: ${vh}px`);
    } else {
        console.log("[OSUtil] Landscape detected – skipping height update");
    }
};
