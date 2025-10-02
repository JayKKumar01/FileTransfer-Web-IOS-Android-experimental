export const formatFileSize = (bytes) => {
    if (bytes === 0 || bytes == null) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure division does not produce NaN for very small numbers
    const size = bytes / Math.pow(k, i);

    // Keep two decimals only for sizes >= 1 KB
    const formattedSize = i === 0 ? size : size.toFixed(2);

    return `${formattedSize} ${sizes[i]}`;
};
