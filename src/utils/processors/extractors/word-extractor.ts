"use server";

import mammoth from "mammoth";

/**
 * Extracts text content from Word documents (.doc, .docx).
 * @param buffer - The document buffer
 * @returns The extracted text content
 */
export async function extractWordText(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value || result.value.trim().length === 0) {
        throw new Error("No text content found in Word document");
    }
    return result.value;
}
