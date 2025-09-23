// src/utils/peerUtils.js
export const PREFIX = "jaykkumar01-ft-web-ios-android-";

export function generatePeerId() {
    return PREFIX + Math.floor(100000 + Math.random() * 900000); // 6-digit numeric
}
