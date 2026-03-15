"use server";

import { Innertube } from "youtubei.js";
import ytdl from "@distube/ytdl-core";
import { YtDlp } from "ytdlp-nodejs";
import path from "path";
import { streamToBuffer, DownloadResultType } from "./stream-utils";

let ytdlpInstance: YtDlp | null = null;

/**
 * Gets or creates a singleton yt-dlp instance with explicit binary path.
 */
function getYtDlp(): YtDlp {
    if (!ytdlpInstance) {
        const binaryPath = path.join(
            process.cwd(),
            "node_modules",
            "ytdlp-nodejs",
            "bin",
            process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
        );
        ytdlpInstance = new YtDlp({ binaryPath });
    }
    return ytdlpInstance;
}

/**
 * Downloads audio using yt-dlp (most reliable method).
 */
export async function downloadWithYtDlp(videoUrl: string): Promise<DownloadResultType> {
    const ytdlp = getYtDlp();

    const isInstalled = await ytdlp.checkInstallationAsync();
    if (!isInstalled) {
        throw new Error("yt-dlp binary not available. Please run: npx ytdlp-nodejs install");
    }

    const file = await ytdlp.getFileAsync(videoUrl, {
        format: {
            filter: "audioonly",
            quality: 10,
            type: "mp3",
        },
        onProgress: (progress) => {
            console.log(`yt-dlp: ${progress.downloaded || ""} downloaded`);
        },
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
        buffer,
        format: file.type || "audio/mp3",
        size: buffer.length,
    };
}

/**
 * Downloads audio using youtubei.js.
 */
export async function downloadWithYoutubeiJs(videoId: string): Promise<DownloadResultType> {
    const innertube = await Innertube.create({
        retrieve_player: true,
        generate_session_locally: true,
    });

    const videoInfo = await innertube.getBasicInfo(videoId);

    if (!videoInfo.streaming_data) {
        throw new Error("No streaming data available for this video");
    }

    const audioFormats = videoInfo.streaming_data.adaptive_formats.filter(
        (format) => format.has_audio && !format.has_video
    );

    if (audioFormats.length === 0) {
        throw new Error("No audio-only formats available");
    }

    const sortedFormats = audioFormats.sort(
        (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0)
    );
    const bestFormat = sortedFormats[0];

    if (innertube.session.player && bestFormat.decipher) {
        try {
            const formatUrl = await bestFormat.decipher(innertube.session.player);
            if (formatUrl) {
                const response = await fetch(formatUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });

                if (response.ok && response.body) {
                    const buffer = await streamToBuffer(response.body);
                    return {
                        buffer,
                        format: bestFormat.mime_type ?? "audio/mp4",
                        size: buffer.length,
                    };
                }
            }
        } catch {
            // Continue to fallback
        }
    }

    const stream = await innertube.download(videoId, {
        type: "audio",
        quality: "best",
    });

    const buffer = await streamToBuffer(stream);

    return {
        buffer,
        format: bestFormat.mime_type ?? "audio/mp4",
        size: buffer.length,
    };
}

/**
 * Downloads audio using @distube/ytdl-core.
 */
export async function downloadWithYtdlCore(videoUrl: string): Promise<DownloadResultType> {
    const info = await ytdl.getInfo(videoUrl);
    const audioFormats = ytdl.filterFormats(info.formats, "audioonly");

    if (audioFormats.length === 0) {
        throw new Error("No audio formats available");
    }

    const format = ytdl.chooseFormat(audioFormats, { quality: "highestaudio" });

    const stream = ytdl(videoUrl, {
        format: format,
        requestOptions: {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        },
    });

    const buffer = await streamToBuffer(stream);

    return {
        buffer,
        format: format.mimeType ?? "audio/mp4",
        size: buffer.length,
    };
}

/**
 * Response type for Cobalt API.
 */
interface CobaltResponseType {
    status: string;
    url?: string;
    error?: string;
    text?: string;
    picker?: Array<{ type: string; url: string }>;
}

/**
 * Downloads audio using Cobalt API (public hosted service).
 */
export async function downloadWithCobaltApi(videoUrl: string): Promise<DownloadResultType> {
    const apiUrl = "https://api.cobalt.tools/";

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            url: videoUrl,
            downloadMode: "audio",
            audioFormat: "mp3",
        }),
    });

    if (!response.ok) {
        throw new Error(`Cobalt API returned status ${response.status}`);
    }

    const data = await response.json() as CobaltResponseType;

    if (data.status === "error") {
        throw new Error(data.text || data.error || "Cobalt API returned an error");
    }

    if (data.status !== "redirect" && data.status !== "tunnel" && data.status !== "stream") {
        if (data.status === "picker" && data.picker?.length) {
            const audioOption = data.picker.find((p) => p.type === "audio") || data.picker[0];
            const audioResponse = await fetch(audioOption.url);
            if (!audioResponse.ok || !audioResponse.body) {
                throw new Error("Failed to download from Cobalt picker URL");
            }
            const buffer = await streamToBuffer(audioResponse.body);
            return { buffer, format: "audio/mp3", size: buffer.length };
        }
        throw new Error(`Unexpected Cobalt status: ${data.status}`);
    }

    if (!data.url) {
        throw new Error("Cobalt API did not return a download URL");
    }

    const audioResponse = await fetch(data.url);
    if (!audioResponse.ok || !audioResponse.body) {
        throw new Error(`Failed to download audio from Cobalt URL: ${audioResponse.status}`);
    }

    const buffer = await streamToBuffer(audioResponse.body);

    return {
        buffer,
        format: "audio/mp3",
        size: buffer.length,
    };
}
