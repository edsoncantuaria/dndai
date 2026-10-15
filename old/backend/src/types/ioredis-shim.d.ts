declare module 'ioredis' {
    class Redis {
        constructor(url: string, opts?: Record<string, unknown>);
        connect(): Promise<void>;
        disconnect(): void;
        get(key: string): Promise<string | null>;
        set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null>;
        del(key: string): Promise<number>;
    }
    export default Redis;
}
