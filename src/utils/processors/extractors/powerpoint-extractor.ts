"use server";

import JSZip from "jszip";

/**
 * Extracts text content from PowerPoint files (.pptx).
 * @param buffer - The PowerPoint file buffer
 * @returns The extracted text content
 */
export async function extractPowerPointText(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const textParts: string[] = [];

    const slideFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
    );

    for (const slideFile of slideFiles) {
        const slideContent = await zip.files[slideFile].async("text");
        const textMatches = slideContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);

        if (textMatches) {
            const slideText = textMatches
                .map((match) => match.replace(/<[^>]*>/g, "").trim())
                .filter((text) => text.length > 0)
                .join(" ");

            if (slideText) {
                const slideNumber = slideFile.match(/slide(\d+)/)?.[1] || "unknown";
                textParts.push(`\n=== Slide ${slideNumber} ===\n${slideText}`);
            }
        }
    }

    const notesFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith("ppt/notesSlides/notesSlide") && name.endsWith(".xml")
    );

    for (const notesFile of notesFiles) {
        const notesContent = await zip.files[notesFile].async("text");
        const textMatches = notesContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);

        if (textMatches) {
            const notesText = textMatches
                .map((match) => match.replace(/<[^>]*>/g, "").trim())
                .filter((text) => text.length > 0)
                .join(" ");

            if (notesText) {
                const slideNumber = notesFile.match(/notesSlide(\d+)/)?.[1] || "unknown";
                textParts.push(`\n=== Slide ${slideNumber} Notes ===\n${notesText}`);
            }
        }
    }

    const result = textParts.join("\n");
    if (result.trim().length === 0) {
        throw new Error("No text content found in PowerPoint slides");
    }

    return result;
}
