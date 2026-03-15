"use server";

import { Innertube } from "youtubei.js";

/**
 * Video information from YouTube.
 */
export interface VideoInfoType {
    title: string;
    channel: string;
    duration: number;
}

/**
 * Fetches transcript/captions directly from YouTube using youtubei.js.
 * @param videoId - The YouTube video ID
 * @returns The transcript text, or null if unavailable
 */
export async function getYoutubeTranscript(videoId: string): Promise<string | null> {
    try {
        const innertube = await Innertube.create({
            retrieve_player: false,
        });

        const info = await innertube.getInfo(videoId);
        const transcriptInfo = await info.getTranscript();

        if (!transcriptInfo?.transcript?.content?.body?.initial_segments) {
            return null;
        }

        const segments = transcriptInfo.transcript.content.body.initial_segments;
        const transcriptParts: string[] = [];

        for (const segment of segments) {
            if (segment.snippet?.runs) {
                const text = segment.snippet.runs
                    .map((run: { text?: string }) => run.text || "")
                    .join("");
                if (text.trim()) {
                    transcriptParts.push(text.trim());
                }
            }
        }

        if (transcriptParts.length === 0) {
            return null;
        }

        return transcriptParts.join(" ");
    } catch {
        return null;
    }
}

/**
 * Fetches basic information about a YouTube video.
 * @param videoId - The YouTube video ID
 * @returns Video title, channel name, and duration in seconds
 */
export async function getYoutubeVideoInfo(videoId: string): Promise<VideoInfoType> {
    try {
        const innertube = await Innertube.create({
            retrieve_player: false,
        });

        const info = await innertube.getBasicInfo(videoId);

        return {
            title: info.basic_info?.title || `YouTube Video ${videoId}`,
            channel: info.basic_info?.author || "Unknown Channel",
            duration: info.basic_info?.duration || 0,
        };
    } catch {
        return {
            title: `YouTube Video ${videoId}`,
            channel: "Unknown Channel",
            duration: 0,
        };
    }
}
