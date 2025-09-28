import React, { createContext, useState, useCallback } from 'react';

export const LogContext = createContext({
    logMessages: [],
    pushLog: () => {},
});

export const LogProvider = ({ children }) => {
    const [logMessages, setLogMessages] = useState([]);

    // Memoized pushLog prevents re-renders triggering useEffect loops
    const pushLog = useCallback((msg) => {
        setLogMessages((prev) => [...prev, msg].slice(-100));
    }, []);

    return (
        <LogContext.Provider value={{ logMessages, pushLog }}>
            {children}
        </LogContext.Provider>
    );
};
