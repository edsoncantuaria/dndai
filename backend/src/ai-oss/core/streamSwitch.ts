export function isOssStreamEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
        (process.env.OSS_STREAM_NARRATION ?? 'false').trim().toLowerCase(),
    );
}
