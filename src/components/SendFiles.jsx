import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SendFiles.css";
import { FileContext } from "../contexts/FileContext";
import {formatFileSize} from "../utils/fileUtil";

const SendFiles = () => {
    const { files } = useContext(FileContext);
    const navigate = useNavigate();

    return (
        <div className="send-files-container">
            <div className="send-files-list">
                <ul>
                    {files.map((file, index) => (
                        <li className="send-file-item" key={index}>
                            <div className="file-row file-name-row">
                                <span className="file-name">{file.name}</span>
                            </div>
                            <div className="file-row file-progress-row">
                                <span className="file-progress-text">
                                    0 KB / {formatFileSize(file.size)}
                                </span>
                            </div>
                            <div className="file-row progress-bar-row">
                                <div className="progress-bar">
                                    <div className="progress-fill" />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <span
                className="back-button"
                onClick={() => navigate("/files")}
            >
                Return to File Selection
            </span>
        </div>
    );
};

export default SendFiles;
