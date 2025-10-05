# FileTransfer Web Application - iOS and Android

## Live Demo

🚀 **Try it now:** [FileTransfer-Web-IOS-Android](https://jaykkumar01.github.io/FileTransfer-Web-IOS-Android/) – access instantly without any setup.
---

## Overview

This web application enables **peer-to-peer file transfer** using PeerJS and works seamlessly on **both iOS and Android devices**.

Its **main highlight** is the combination of **QR code-based peer connection** and **seamless cross-platform file transfer**, which allows users to send files **super easily, without any quality loss**, and **without relying on cloud storage**. The workflow is designed to be **smooth, fast, and intuitive**, making file sharing between iOS and Android devices effortless.

Key capabilities include:

* **Instant QR code-based peer connection** for super-fast setup without typing IDs.
* **Cross-platform file transfer** between iOS and Android with original file quality preserved.
* **Send and receive multiple files simultaneously**, including large files.
* **Dynamic file chunking** to optimize transfer speed.
* **Optional ZIP compression** for received files (up to 4 GB on iOS).
* **Platform-specific optimizations** for iOS (prevent pinch/zoom, viewport adjustments, Wake Lock API).
* **Real-time transfer progress and speed monitoring**.

---

## Features

| Feature                             | Description                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| **QR Code Peer Connection**         | Instantly connect devices using QR codes — no typing required.                   |
| **Seamless iOS ↔ Android Transfer** | Super simple cross-platform file sharing while preserving original file quality. |
| Multi-File Support                  | Send multiple files at once without compressing by default.                      |
| Real-Time Progress                  | Monitor per-file transfer progress and speed dynamically.                        |
| ZIP Download                        | Compress received files into a single ZIP archive (up to 4 GB on iOS).           |
| iOS Optimizations                   | Prevent pinch/zoom, adjust viewport height, and keep the screen awake.           |

## Table of Contents

1. [Installation](#installation)
2. [Usage](#usage)
3. [File Flow](#file-flow)
4. [Project Structure](#project-structure)
5. [Utilities](#utilities)
6. [Known Limitations](#known-limitations)
7. [Contributing](#contributing)
8. [License](#license)

---

## Installation

This project is fully hosted and **does not require any installation** for basic usage. Just open the live demo in your browser on iOS or Android:

[FileTransfer Web App](https://jaykkumar01.github.io/FileTransfer-Web-IOS-Android/)

If you want to run locally:

```bash
git clone https://github.com/jaykkumar01/FileTransfer-Web-IOS-Android.git
cd FileTransfer-Web-IOS-Android
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your mobile browser.

---

## Usage

1. **Initialize App**

    * Tap **“Keep Screen Awake & Initialize”** to enable Wake Lock (prevents device from sleeping during transfer).

2. **Connect via QR Code**

    * One device generates a QR code.
    * Scan the QR code on the other device.
    * Devices are now connected instantly without typing long IDs.

3. **Select Files to Send**

    * On the sending device, select one or more files.
    * Proceed to the **Send** screen.

4. **Monitor Transfer**

    * Real-time progress bars and speed indicators show the status of each file.

5. **Receive Files**

    * The receiving device can monitor progress.
    * Optionally download multiple files as a ZIP archive (up to 4 GB on iOS).

6. **Cross-Platform**

    * Works flawlessly between iOS and Android.
    * Original file quality is always preserved.

---

## File Flow

1. **File Selection**

    * User selects files via the `FileInput` component.
    * Files are added to the context for state management.

2. **Sending Files**

    * Files are chunked dynamically based on device and network speed.
    * Progress is tracked using `createTrackingManager`.

3. **Receiving Files**

    * Files arrive in real-time.
    * Optionally, multiple files can be compressed into a ZIP using `downloadZip`.

4. **Completion**

    * All files are available to view or download in full original quality.

---

## Project Structure

```
src/
├─ components/
│  ├─ FileInput.jsx         # File selection UI
│  ├─ PeerConnect.jsx       # QR code & manual peer connection
│  ├─ QRScanner.jsx         # QR scanning component
│  ├─ SendFiles.jsx         # Display files being sent
│  ├─ ReceiveFiles.jsx      # Display files being received
│  └─ TabBar.jsx            # Bottom navigation
├─ contexts/
│  ├─ FileContext.jsx       # Manage files and downloads
│  ├─ LogContext.jsx        # Central logging
│  └─ PeerContext.jsx       # PeerJS connection context
├─ utils/
│  ├─ osUtil.js             # Detect Apple/Android & prevent pinch zoom
│  ├─ zipUtil.js            # ZIP file creation and download
│  ├─ wakeLock.js           # Wake Lock handling
│  └─ fileUtil.js           # File formatting helpers
└─ App.jsx                  # Main app routing & initialization
```

---

## Utilities

* **`osUtil.js`** – Detects Apple/Android devices, handles iOS viewport & pinch prevention.
* **`wakeLock.js`** – Requests and maintains Wake Lock to keep screen awake.
* **`zipUtil.js`** – Creates ZIP archives for multiple files with progress tracking.
* **`fileUtil.js`** – File size formatting and helper functions.

---

## Known Limitations

* **ZIP downloads on iOS** limited to **4 GB total** per archive.
* Background tab suspension on iOS may interrupt transfers in Safari.
* Android browsers may require camera permissions for QR scanning.

---

## Contributing

1. Fork the repo.
2. Create a new branch for your feature/bugfix.
3. Submit a pull request with a clear description.

---

## License

MIT License.

---
