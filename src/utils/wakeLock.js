let wakeLock = null;
let retryInterval = null;

/**
 * Request a screen wake lock to prevent the device from sleeping.
 * Automatically tries to reacquire on visibility change (iOS & Chrome).
 * @param {Function} onStatusChange Optional callback: receives { status, error }
 */
export async function requestWakeLock(onStatusChange) {
    try {
        if ('wakeLock' in navigator) {
            // Function to request the lock
            const acquireLock = async () => {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    if (onStatusChange) onStatusChange({ status: 'active' });

                    // Handle release (reacquire automatically)
                    wakeLock.addEventListener('release', () => {
                        if (onStatusChange) onStatusChange({ status: 'released' });
                    });
                } catch (err) {
                    if (onStatusChange) onStatusChange({ status: 'error', error: err });
                }
            };

            await acquireLock();

            // Re-acquire on visibility change
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible') {
                    await acquireLock();
                    if (onStatusChange) onStatusChange({ status: 'reacquired' });
                }
            });

            // Safari/iOS may drop wake lock when tab is backgrounded
            // Retry every few seconds as a fallback
            if (!retryInterval) {
                retryInterval = setInterval(async () => {
                    if (wakeLock === null && document.visibilityState === 'visible') {
                        await acquireLock();
                        if (onStatusChange) onStatusChange({ status: 'reacquired' });
                    }
                }, 5000); // retry every 5 seconds
            }

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

    // Clear retry interval
    if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
    }
}