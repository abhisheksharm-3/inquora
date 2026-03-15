"use server";

import { Readable } from "stream";
import { YOUTUBE_DOWNLOAD } from "@/config/constants";

/**
 * Result of a successful audio download.
 */
export interface DownloadResultType {
    buffer: Buffer;
    format: string;
    size: number;
}

/**
 * Converts a ReadableStream to a Buffer with timeout and size limit.
 * @param stream - The stream to convert (Node.js Readable or Web ReadableStream)
 * @param timeoutMs - Maximum time to wait for download
 * @param maxSize - Maximum allowed size in bytes
 */
export async function streamToBuffer(
    stream: ReadableStream<Uint8Array> | Readable,
    timeoutMs: number = YOUTUBE_DOWNLOAD.TIMEOUT_MS,
    maxSize: number = YOUTUBE_DOWNLOAD.MAX_AUDIO_SIZE_BYTES
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        let totalSize = 0;

        const timeout = setTimeout(() => {
            reject(new Error(`Download timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);

        if (stream instanceof Readable) {
            stream.on("data", (chunk: Buffer) => {
                totalSize += chunk.length;
                if (totalSize > maxSize) {
                    stream.destroy();
                    clearTimeout(timeout);
                    reject(
                        new Error(
                            `Audio file too large (>${maxSize / 1024 / 1024}MB). Try a shorter video.`
                        )
                    );
                    return;
                }
                chunks.push(chunk);
            });
            stream.on("end", () => {
                clearTimeout(timeout);
                resolve(Buffer.concat(chunks));
            });
            stream.on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            return;
        }

        const reader = stream.getReader();

        const read = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    totalSize += value.length;
                    if (totalSize > maxSize) {
                        reader.cancel();
                        clearTimeout(timeout);
                        reject(
                            new Error(
                                `Audio file too large (>${maxSize / 1024 / 1024}MB). Try a shorter video.`
                            )
                        );
                        return;
                    }
                    chunks.push(value);
                }
                clearTimeout(timeout);
                resolve(Buffer.concat(chunks));
            } catch (err) {
                clearTimeout(timeout);
                reject(err);
            }
        };

        read();
    });
}
