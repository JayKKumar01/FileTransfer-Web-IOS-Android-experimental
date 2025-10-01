// Detect any Apple device (iPhone, iPad, iPod, Mac, Apple TV, Watch)
export const isApple = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const platform = navigator.platform || "";

    // iPhone, iPod, iPad
    if (/iPhone|iPod|iPad/.test(ua)) return true;

    // MacBooks / iMac / Mac Mini / Mac Pro (Intel & Apple Silicon)
    if (platform.includes("Mac")) return true;

    // Apple TV
    if (/AppleTV/.test(ua)) return true;

    // Apple Watch
    if (/Watch/.test(ua)) return true;

    // iPadOS 13+ in desktop mode reports Mac, detect via touch points
    if (platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;

    return false;
};

export const isAndroid = () => {
    return /Android/i.test(navigator.userAgent);
}

/**
 * Prevent pinch/zoom on iOS
 */
export const preventPinchZoom = (logCallback) => {
    if (!isApple()) return;

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
