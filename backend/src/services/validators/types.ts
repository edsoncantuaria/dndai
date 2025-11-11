import type { GameMasterResponse } from '../../types.js';

export interface ValidationIssue {
    phase: string;
    path: string;
    problem: string;
    severity: 'info' | 'warning' | 'error';
}

export type Validator = (response: GameMasterResponse) => ValidationIssue[];

export const createIssue = (
    phase: string,
    path: string,
    problem: string,
    severity: ValidationIssue['severity']
): ValidationIssue => ({ phase, path, problem, severity });

export type { GameMasterResponse };
