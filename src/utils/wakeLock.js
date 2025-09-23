let wakeLock = null;

/**
 * Request a screen wake lock to prevent the device from sleeping.
 * @param {Function} onStatusChange Optional callback: receives { status, error }
 */
export async function requestWakeLock(onStatusChange) {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');

            if (onStatusChange) onStatusChange({ status: 'active' });

            // Re-acquire if it’s released (visibility change)
            document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                    if (onStatusChange) onStatusChange({ status: 'reacquired' });
                }
            });
        } else {
            if (onStatusChange) onStatusChange({ status: 'unsupported' });
        }
    } catch (err) {
        if (onStatusChange) onStatusChange({ status: 'error', error: err });
    }
}

/**
 * Release the wake lock manually.
 */
export async function releaseWakeLock(onStatusChange) {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null;
            if (onStatusChange) onStatusChange({ status: 'released' });
        } catch (err) {
            if (onStatusChange) onStatusChange({ status: 'error', error: err });
        }
    }
}
