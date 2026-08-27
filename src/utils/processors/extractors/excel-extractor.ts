"use server";

import ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * Check if buffer contains XLSX file signature.
 */
function isXlsxFile(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * Enhanced fallback text extraction for Excel files.
 */
async function extractExcelTextFallback(buffer: Buffer): Promise<string> {
  let extractedText = buffer
    .toString("utf8")
    .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (extractedText.length < 100) {
    const latin1Text = buffer
      .toString("latin1")
      .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (latin1Text.length > extractedText.length) {
      extractedText = latin1Text;
    }
  }

  const words = extractedText
    .split(/\s+/)
    .filter((word) => word.length > 2 && /[a-zA-Z0-9]/.test(word))
    .slice(0, 500);

  if (words.length < 5) {
    throw new Error("Insufficient readable content found in file");
  }

  return `=== Excel Content (Fallback Extraction) ===\n\nExtracted text content:\n${words.join(" ")}`;
}

/**
 * Alternative Excel extraction using JSZip for .xlsx files.
 */
async function extractExcelWithJSZip(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const textParts: string[] = ["=== Excel Spreadsheet Content (JSZip Method) ===\n"];

  const worksheetFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml"),
  );

  for (const worksheetFile of worksheetFiles) {
    const worksheetContent = await zip.files[worksheetFile].async("text");
    const cellMatches = worksheetContent.match(/<v[^>]*>([^<]+)<\/v>/g);
    const textMatches = worksheetContent.match(/<t[^>]*>([^<]+)<\/t>/g);

    const sheetNumber = worksheetFile.match(/sheet(\d+)/)?.[1] || "unknown";
    textParts.push(`\n=== Sheet ${sheetNumber} ===\n`);

    if (cellMatches) {
      const cellValues = cellMatches
        .map((match) => match.replace(/<[^>]*>/g, "").trim())
        .filter((text) => text.length > 0);
      if (cellValues.length > 0) {
        textParts.push("Numeric values: " + cellValues.join(", "));
      }
    }

    if (textMatches) {
      const textValues = textMatches
        .map((match) => match.replace(/<[^>]*>/g, "").trim())
        .filter((text) => text.length > 0);
      if (textValues.length > 0) {
        textParts.push("Text values: " + textValues.join(", "));
      }
    }
  }

  if (zip.files["xl/sharedStrings.xml"]) {
    const sharedStringsContent = await zip.files["xl/sharedStrings.xml"].async("text");
    const stringMatches = sharedStringsContent.match(/<t[^>]*>([^<]+)<\/t>/g);

    if (stringMatches) {
      const sharedStrings = stringMatches
        .map((match) => match.replace(/<[^>]*>/g, "").trim())
        .filter((text) => text.length > 0);
      if (sharedStrings.length > 0) {
        textParts.push("\n=== Shared Strings ===\n" + sharedStrings.join(", "));
      }
    }
  }

  const result = textParts.join("\n");
  if (result.trim().length === 0) {
    throw new Error("No text content found in Excel file");
  }

  return result;
}

/**
 * Extracts text content from Excel files (.xls, .xlsx).
 * Uses multiple fallback methods for best compatibility.
 * @param buffer - The Excel file buffer
 * @returns The extracted text content
 */
export async function extractExcelText(buffer: Buffer): Promise<string> {
  const textParts: string[] = [];
  const isXlsx = isXlsxFile(buffer);

  if (buffer.length === 0) {
    throw new Error("Empty file buffer");
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    await workbook.xlsx.load(arrayBuffer as ArrayBuffer);

    textParts.push("=== Excel Spreadsheet Content ===\n");

    workbook.worksheets.forEach((worksheet) => {
      textParts.push(`\n=== Sheet: ${worksheet.name} ===\n`);

      worksheet.eachRow((row, rowNumber) => {
        const rowValues = row.values;
        if (Array.isArray(rowValues) && rowValues.length > 1) {
          const rowText = rowValues
            .slice(1)
            .map((cell) => (cell != null ? String(cell).trim() : ""))
            .filter((text) => text.length > 0)
            .join(" | ");

          if (rowText) {
            textParts.push(`Row ${rowNumber}: ${rowText}`);
          }
        }
      });
    });

    const result = textParts.join("\n");
    if (result.trim().length === 0) {
      throw new Error("No readable content found in spreadsheet");
    }
    return result;
  } catch (excelJsError) {
    if (isXlsx) {
      try {
        return await extractExcelWithJSZip(buffer);
      } catch {
        // Continue to final fallback
      }
    }

    try {
      return await extractExcelTextFallback(buffer);
    } catch {
      throw new Error(
        `All Excel extraction methods failed. File may be corrupted or in an unsupported format. Original error: ${excelJsError instanceof Error ? excelJsError.message : String(excelJsError)}`,
      );
    }
  }
}
