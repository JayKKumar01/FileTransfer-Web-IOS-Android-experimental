import React, { useState } from "react";
import "../styles/FileInput.css";

const FileInput = () => {
    const [files, setFiles] = useState([]);

    const handleFilesChange = (event) => {
        setFiles(Array.from(event.target.files));
    };

    return (
        <div className="FileInput">
            <h2>Select files to upload</h2>
            <input
                type="file"
                multiple
                onChange={handleFilesChange}
            />

            {files.length > 0 && (
                <div className="FileList">
                    <h3>Selected Files:</h3>
                    <ul>
                        {files.map((file, idx) => (
                            <li key={idx}>{file.name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default FileInput;
