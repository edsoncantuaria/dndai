export const appendSystemLogEntry = (existing: string | null | undefined, message: string) =>
    existing && existing.length ? `${existing}\n${message}` : message;
