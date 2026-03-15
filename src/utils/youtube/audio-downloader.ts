"use server";

import {
    downloadWithYtDlp,
    downloadWithYoutubeiJs,
    downloadWithYtdlCore,
    downloadWithCobaltApi,
} from "./download-methods";

/**
 * Downloads YouTube video audio with automatic fallback.
 * Tries: 1) yt-dlp (most reliable), 2) youtubei.js, 3) ytdl-core, 4) Cobalt API.
 *
 * @param videoId - The YouTube video ID
 * @param videoUrl - The full YouTube video URL
 * @returns Buffer containing the audio data and mime type
 * @throws Error if all download methods fail
 */
export async function downloadYoutubeAudio(
    videoId: string,
    videoUrl: string
): Promise<{ buffer: Buffer; mimeType: string }> {
    const errors: string[] = [];

    try {
        const result = await downloadWithYtDlp(videoUrl);
        return { buffer: result.buffer, mimeType: result.format };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`yt-dlp: ${message}`);
    }

    try {
        const result = await downloadWithYoutubeiJs(videoId);
        return { buffer: result.buffer, mimeType: result.format };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`youtubei.js: ${message}`);
    }

    try {
        const result = await downloadWithYtdlCore(videoUrl);
        return { buffer: result.buffer, mimeType: result.format };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`ytdl-core: ${message}`);
    }

    try {
        const result = await downloadWithCobaltApi(videoUrl);
        return { buffer: result.buffer, mimeType: result.format };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Cobalt API: ${message}`);
    }

    throw new Error(
        `Failed to download YouTube audio. Tried methods:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
}
