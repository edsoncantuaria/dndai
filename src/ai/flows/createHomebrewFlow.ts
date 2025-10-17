// src/ai/flows/createHomebrewFlow.ts
'use server';

// This file is kept for historical purposes, but the logic has been moved to the backend.
// The backend-centered approach is more robust, secure, and avoids client-side environment issues.

export const createHomebrewContent = async (input: any): Promise<any> => {
    console.error("DEPRECATED: createHomebrewContent in frontend is no longer used. Use the backend service.");
    throw new Error("This function is deprecated and should not be called.");
};
