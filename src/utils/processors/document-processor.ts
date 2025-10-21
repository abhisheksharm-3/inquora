"use server";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";
import mammoth from "mammoth";

// --- Constants ---
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * A shared helper to process and store document chunks in Pinecone.
 * This function handles splitting, embedding, and storing with retry logic.
 * @private
 */
const _processAndStoreDocuments = async (
  docs: Document[],
  namespace: string,
): Promise<{ numDocs: number }> => {
  if (!docs || docs.length === 0) {
    throw new Error("No processable content found in the document.");
  }

  // 1. Split documents into chunks
  console.log(`Splitting ${docs.length} document(s) into chunks...`);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const chunkedDocs = await textSplitter.splitDocuments(docs);
  
  // Filter out empty or whitespace-only chunks
  const validChunks = chunkedDocs.filter(doc => {
    const content = doc.pageContent?.trim();
    return content && content.length > 0;
  });
  
  const filteredCount = chunkedDocs.length - validChunks.length;
  if (filteredCount > 0) {
    console.log(`Filtered out ${filteredCount} empty chunks`);
  }
  
  console.log(`Document split into ${validChunks.length} valid chunks.`);

  // 2. Create embeddings
  console.log("Creating Gemini embeddings...");
  const embeddings = await createGeminiEmbeddings();
  if (!embeddings) {
    throw new Error(
      "Failed to create embeddings. Gemini API may not be configured properly.",
    );
  }

  // 3. Store documents in Pinecone with retry logic
  console.log(`Storing chunks in Pinecone with namespace: ${namespace}...`);
  const pineconeIndex = await getPineconeIndex();
  if (!pineconeIndex) {
    throw new Error("Pinecone index is not initialized.");
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      // Final validation before storing
      const finalValidChunks = validChunks.filter(doc => {
        const content = doc.pageContent?.trim();
        return content && content.length > 0;
      });

      if (finalValidChunks.length === 0) {
        throw new Error("No valid chunks to store after filtering");
      }

      await PineconeStore.fromDocuments(finalValidChunks, embeddings, {
        pineconeIndex,
        namespace,
      });
      console.log("Successfully stored document chunks in Pinecone.");
      return { numDocs: finalValidChunks.length };
    } catch (error) {
      retries++;
      console.error(
        `Error storing in Pinecone (attempt ${retries}/${MAX_RETRIES}):`,
        error,
      );
      if (retries >= MAX_RETRIES) {
        throw error; // Re-throw after final attempt
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new Error(
    "Failed to store documents in Pinecone after multiple retries.",
  );
};

/**
 * Extracts text from various document types (Word, Excel, PowerPoint) with enhanced methods.
 * @private
 */
const _extractTextFromGenericDocument = async (
  fileBlob: Blob,
  documentType: string,
): Promise<string> => {
  console.log(`Extracting text from ${documentType}...`);
  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  switch (documentType) {
    case "doc":
    case "docs":
    case "docx":
      try {
        const docxResult = await mammoth.extractRawText({ buffer });
        if (docxResult.value && docxResult.value.trim().length > 0) {
          return docxResult.value;
        }
        throw new Error("No text content found in document");
      } catch (error) {
        console.error("Error extracting DOCX:", error);
        throw new Error(
          `Failed to extract text from Word document: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

    case "sheet":
    case "sheets":
    case "xls":
    case "xlsx":
      try {
        // Enhanced Excel processing with multiple methods
        return await _extractExcelText(buffer, documentType);
      } catch (error) {
        console.error("Error extracting Excel:", error);
        throw new Error(
          `Failed to extract text from Excel file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

    case "slides":
    case "ppt":
    case "pptx":
      try {
        // Enhanced PowerPoint processing using JSZip for better extraction
        return await _extractPowerPointText(buffer);
      } catch (error) {
        console.error("Error extracting PowerPoint:", error);
        // Fallback to basic text extraction
        try {
          const fallbackText = buffer
            .toString("utf8")
            .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (fallbackText.length > 50) {
            return fallbackText;
          }
          throw new Error("Insufficient content extracted");
        } catch {
          throw new Error(
            `Failed to extract text from PowerPoint file: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
};

/**
 * Enhanced Excel text extraction with multiple fallback methods
 * @private
 */
const _extractExcelText = async (
  buffer: Buffer,
  documentType: string,
): Promise<string> => {
  const textParts: string[] = [];

  // Determine file type from buffer signature
  const isXlsxFile = _isXlsxFile(buffer);
  const isXlsFile = _isXlsFile(buffer);

  console.log(
    `Processing Excel file: type=${documentType}, isXlsx=${isXlsxFile}, isXls=${isXlsFile}`,
  );

  // Method 1: Try ExcelJS for both XLS and XLSX
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    // Validate the buffer before processing
    if (buffer.length === 0) {
      throw new Error("Empty file buffer");
    }

    // Use different methods based on file type
    if (isXlsxFile) {
      // For XLSX files, use xlsx.load
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
      await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
    } else {
      // For XLS files or uncertain types, try csv.load as a fallback
      // ExcelJS doesn't fully support XLS format, so we'll try the stream approach
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
      await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
    }

    // Add header
    textParts.push("=== Excel Spreadsheet Content ===\n");

    workbook.worksheets.forEach((worksheet) => {
      textParts.push(`\n=== Sheet: ${worksheet.name} ===\n`);

      worksheet.eachRow((row, rowNumber) => {
        const rowValues = row.values as unknown[];
        if (Array.isArray(rowValues) && rowValues.length > 1) {
          // Skip index 0 which is undefined
          const rowText = rowValues
            .slice(1) // Remove the first undefined element
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
    console.warn("ExcelJS method failed:", excelJsError);

    // Method 2: Try JSZip extraction for .xlsx files only
    if (isXlsxFile) {
      try {
        return await _extractExcelWithJSZip(buffer);
      } catch (jsZipError) {
        console.warn("JSZip method failed:", jsZipError);
      }
    }

    // Method 3: Enhanced text extraction with better parsing for XLS files
    try {
      return await _extractExcelTextFallback(buffer);
    } catch (fallbackError) {
      console.warn("Fallback method failed:", fallbackError);
      throw new Error(
        `All Excel extraction methods failed. File may be corrupted or in an unsupported format. Original error: ${excelJsError instanceof Error ? excelJsError.message : String(excelJsError)}`,
      );
    }
  }
};

/**
 * Check if buffer contains XLSX file signature
 * @private
 */
const _isXlsxFile = (buffer: Buffer): boolean => {
  // XLSX files start with PK (ZIP signature)
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
};

/**
 * Check if buffer contains XLS file signature
 * @private
 */
const _isXlsFile = (buffer: Buffer): boolean => {
  // XLS files have different signatures, commonly starting with 0xD0CF (OLE2 format)
  return (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  );
};

/**
 * Enhanced fallback text extraction for Excel files
 * @private
 */
const _extractExcelTextFallback = async (buffer: Buffer): Promise<string> => {
  console.log("Using fallback text extraction method for Excel file");

  // Try to extract readable text from the binary format
  let extractedText = buffer
    .toString("utf8")
    .replace(/[\x00-\x1F\x7F-\x9F]/g, " ") // Remove control characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Also try latin1 encoding which sometimes works better for binary files
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

  // Filter out very short strings and extract meaningful content
  const words = extractedText
    .split(/\s+/)
    .filter((word) => word.length > 2 && /[a-zA-Z0-9]/.test(word))
    .slice(0, 500); // Limit to first 500 meaningful words

  if (words.length < 5) {
    throw new Error("Insufficient readable content found in file");
  }

  const result = `=== Excel Content (Fallback Extraction) ===\n\nExtracted text content:\n${words.join(" ")}`;

  console.log(`Fallback extraction found ${words.length} meaningful words`);
  return result;
};

/**
 * Alternative Excel extraction using JSZip for .xlsx files
 * @private
 */
const _extractExcelWithJSZip = async (buffer: Buffer): Promise<string> => {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const textParts: string[] = [];

  try {
    textParts.push("=== Excel Spreadsheet Content (JSZip Method) ===\n");

    // Look for worksheet files
    const worksheetFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml"),
    );

    for (const worksheetFile of worksheetFiles) {
      try {
        const worksheetContent = await zip.files[worksheetFile].async("text");

        // Extract text from XML using regex patterns for cell values
        const cellMatches = worksheetContent.match(/<v[^>]*>([^<]+)<\/v>/g);
        const textMatches = worksheetContent.match(/<t[^>]*>([^<]+)<\/t>/g);

        const sheetNumber = worksheetFile.match(/sheet(\d+)/)?.[1] || "unknown";
        textParts.push(`\n=== Sheet ${sheetNumber} ===\n`);

        // Extract numeric values
        if (cellMatches) {
          const cellValues = cellMatches
            .map((match) => match.replace(/<[^>]*>/g, "").trim())
            .filter((text) => text.length > 0);

          if (cellValues.length > 0) {
            textParts.push("Numeric values: " + cellValues.join(", "));
          }
        }

        // Extract text values
        if (textMatches) {
          const textValues = textMatches
            .map((match) => match.replace(/<[^>]*>/g, "").trim())
            .filter((text) => text.length > 0);

          if (textValues.length > 0) {
            textParts.push("Text values: " + textValues.join(", "));
          }
        }
      } catch (sheetError) {
        console.warn(`Error processing ${worksheetFile}:`, sheetError);
      }
    }

    // Also try to extract shared strings
    if (zip.files["xl/sharedStrings.xml"]) {
      try {
        const sharedStringsContent =
          await zip.files["xl/sharedStrings.xml"].async("text");
        const stringMatches =
          sharedStringsContent.match(/<t[^>]*>([^<]+)<\/t>/g);

        if (stringMatches) {
          const sharedStrings = stringMatches
            .map((match) => match.replace(/<[^>]*>/g, "").trim())
            .filter((text) => text.length > 0);

          if (sharedStrings.length > 0) {
            textParts.push(
              "\n=== Shared Strings ===\n" + sharedStrings.join(", "),
            );
          }
        }
      } catch (sharedStringError) {
        console.warn("Error processing shared strings:", sharedStringError);
      }
    }

    const result = textParts.join("\n");
    if (result.trim().length === 0) {
      throw new Error("No text content found in Excel file");
    }

    return result;
  } catch (error) {
    throw new Error(
      `JSZip Excel extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Enhanced PowerPoint text extraction using JSZip
 * @private
 */
const _extractPowerPointText = async (buffer: Buffer): Promise<string> => {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const textParts: string[] = [];

  try {
    // Extract text from slides
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"),
    );

    for (const slideFile of slideFiles) {
      try {
        const slideContent = await zip.files[slideFile].async("text");

        // Extract text from XML using regex patterns
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
      } catch (slideError) {
        console.warn(`Error processing ${slideFile}:`, slideError);
      }
    }

    // Also try to extract from notes if available
    const notesFiles = Object.keys(zip.files).filter(
      (name) =>
        name.startsWith("ppt/notesSlides/notesSlide") && name.endsWith(".xml"),
    );

    for (const notesFile of notesFiles) {
      try {
        const notesContent = await zip.files[notesFile].async("text");
        const textMatches = notesContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
        if (textMatches) {
          const notesText = textMatches
            .map((match) => match.replace(/<[^>]*>/g, "").trim())
            .filter((text) => text.length > 0)
            .join(" ");

          if (notesText) {
            const slideNumber =
              notesFile.match(/notesSlide(\d+)/)?.[1] || "unknown";
            textParts.push(
              `\n=== Slide ${slideNumber} Notes ===\n${notesText}`,
            );
          }
        }
      } catch (notesError) {
        console.warn(`Error processing ${notesFile}:`, notesError);
      }
    }

    const result = textParts.join("\n");
    if (result.trim().length === 0) {
      throw new Error("No text content found in PowerPoint slides");
    }

    return result;
  } catch (error) {
    throw new Error(
      `PowerPoint extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Processes a PDF file by extracting its content and storing it as embeddings in Pinecone.
 *
 * @param fileBlob The PDF file blob.
 * @param namespace The unique ID (and Pinecone namespace) for the file.
 * @returns A promise that resolves with the outcome of the processing.
 */
export const processPdfDocument = async (
  fileBlob: Blob,
  namespace: string,
): Promise<{ numDocs: number; success: boolean; error?: string }> => {
  console.log(`Starting PDF processing for namespace: ${namespace}`);
  if (!(await isPineconeConfigured())) {
    return { success: false, numDocs: 0, error: "Pinecone is not configured." };
  }

  try {
    console.log("Loading PDF document...");
    const loader = new PDFLoader(fileBlob);
    const docs = await loader.load();

    const { numDocs } = await _processAndStoreDocuments(docs, namespace);
    return { numDocs, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to process PDF for namespace ${namespace}:`,
      errorMessage,
    );
    return { numDocs: 0, success: false, error: errorMessage };
  }
};

/**
 * Processes a generic document (Word, Excel) by extracting its text and storing embeddings.
 *
 * @param fileBlob The document file blob.
 * @param namespace The unique ID (and Pinecone namespace) for the file.
 * @param documentType The type of the document (e.g., 'docs', 'sheets').
 * @returns A promise that resolves with the outcome of the processing.
 */
export const processGenericDocument = async (
  fileBlob: Blob,
  namespace: string,
  documentType: string,
): Promise<{ numDocs: number; success: boolean; error?: string }> => {
  console.log(
    `Starting ${documentType} processing for namespace: ${namespace}`,
  );
  if (!(await isPineconeConfigured())) {
    return { success: false, numDocs: 0, error: "Pinecone is not configured." };
  }

  try {
    const text = await _extractTextFromGenericDocument(fileBlob, documentType);
    const doc = new Document({
      pageContent: text,
      metadata: { source: namespace, type: documentType },
    });

    const { numDocs } = await _processAndStoreDocuments([doc], namespace);
    return { numDocs, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to process ${documentType} for namespace ${namespace}:`,
      errorMessage,
    );
    return { numDocs: 0, success: false, error: errorMessage };
  }
};
