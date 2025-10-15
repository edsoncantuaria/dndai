// src/hooks/useGameLog.ts
import { useState, useCallback } from 'react';
import type { LogEntry } from '../types';

export const useGameLog = () => {
    const [log, setLog] = useState<LogEntry[]>([]);

    const addLogEntry = useCallback((entry: LogEntry) => {
        setLog(prev => [...prev, entry]);
    }, []);

    const addLogEntries = useCallback((entries: LogEntry[]) => {
        setLog(prev => [...prev, ...entries]);
    }, []);

    const clearLog = useCallback(() => {
        setLog([]);
    }, []);

    return {
        log,
        setLog,
        addLogEntry,
        addLogEntries,
        clearLog,
    };
};
