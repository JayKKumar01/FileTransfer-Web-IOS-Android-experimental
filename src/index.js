import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { LogProvider } from './contexts/LogContext';
import { PeerProvider } from "./contexts/PeerContext";
import reportWebVitals from './reportWebVitals';
import { HashRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <HashRouter>
        <LogProvider>
            <PeerProvider>
                <App />
            </PeerProvider>
        </LogProvider>
    </HashRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
