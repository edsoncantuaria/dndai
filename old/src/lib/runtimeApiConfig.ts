/** Overrides injetados pelo app Expo (WebView) antes do bundle Next hidratar. */
export type DndaiRuntimeConfig = {
    apiUrl?: string;
    wsUrl?: string;
};

declare global {
    interface Window {
        __DNDAI_RUNTIME_CONFIG__?: DndaiRuntimeConfig;
    }
}

function trimUrl(url: string | undefined): string | undefined {
    return url?.trim().replace(/\/$/, '') || undefined;
}

export function getRuntimeApiUrl(): string {
    const fromWindow =
        typeof window !== 'undefined'
            ? trimUrl(window.__DNDAI_RUNTIME_CONFIG__?.apiUrl)
            : undefined;
    return (
        fromWindow ||
        trimUrl(process.env.NEXT_PUBLIC_API_URL) ||
        'http://localhost:8071/api'
    );
}

export function getRuntimeWsUrl(): string | undefined {
    const fromWindow =
        typeof window !== 'undefined'
            ? trimUrl(window.__DNDAI_RUNTIME_CONFIG__?.wsUrl)
            : undefined;
    return (
        fromWindow ||
        trimUrl(process.env.NEXT_PUBLIC_PENAI_WS_URL) ||
        trimUrl(process.env.NEXT_PUBLIC_WS_URL)
    );
}
