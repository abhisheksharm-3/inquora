"use server";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";
import mammoth from "mammoth";
import ExcelJS from "exceljs";

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
  console.log(`Document split into ${chunkedDocs.length} chunks.`);

  // 2. Create embeddings
  console.log("Creating Gemini embeddings...");
  const embeddings = await createGeminiEmbeddings();
  if (!embeddings) {
    throw new Error("Failed to create embeddings. Gemini API may not be configured properly.");
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
      await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
        pineconeIndex,
        namespace,
      });
      console.log("Successfully stored document chunks in Pinecone.");
      return { numDocs: chunkedDocs.length };
    } catch (error) {
      retries++;
      console.error(`Error storing in Pinecone (attempt ${retries}/${MAX_RETRIES}):`, error);
      if (retries >= MAX_RETRIES) {
        throw error; // Re-throw after final attempt
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new Error("Failed to store documents in Pinecone after multiple retries.");
};

/**
 * Extracts text from various document types (Word, Excel, PowerPoint) with enhanced methods.
 * @private
 */
const _extractTextFromGenericDocument = async (
  fileBlob: Blob,
  documentType: string
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
        throw new Error(`Failed to extract text from Word document: ${error instanceof Error ? error.message : String(error)}`);
      }

    case "sheet":
    case "sheets":
    case "xls":
    case "xlsx":
      try {
        // Use ExcelJS for robust Excel processing
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        await workbook.xlsx.load(arrayBuffer);
        const textParts: string[] = [];
        
        // Add header
        textParts.push("=== Excel Spreadsheet Content ===\n");
        
        workbook.worksheets.forEach((worksheet) => {
          textParts.push(`\n=== Sheet: ${worksheet.name} ===\n`);
          
          worksheet.eachRow((row, rowNumber) => {
            const rowValues = row.values as unknown[];
            if (Array.isArray(rowValues) && rowValues.length > 1) { // Skip index 0 which is undefined
              const rowText = rowValues
                .slice(1) // Remove the first undefined element
                .map(cell => cell != null ? String(cell).trim() : "")
                .filter(text => text.length > 0)
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
      } catch (error) {
        console.error("Error extracting Excel:", error);
        throw new Error(`Failed to extract text from Excel file: ${error instanceof Error ? error.message : String(error)}`);
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
          const fallbackText = buffer.toString("utf8")
            .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          
          if (fallbackText.length > 50) {
            return fallbackText;
          }
          throw new Error("Insufficient content extracted");
        } catch {
          throw new Error(`Failed to extract text from PowerPoint file: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    default:
      throw new Error(`Unsupported document type: ${documentType}`);
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
    const slideFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );

    for (const slideFile of slideFiles) {
      try {
        const slideContent = await zip.files[slideFile].async('text');
        
        // Extract text from XML using regex patterns
        const textMatches = slideContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
        if (textMatches) {
          const slideText = textMatches
            .map(match => match.replace(/<[^>]*>/g, '').trim())
            .filter(text => text.length > 0)
            .join(' ');
          
          if (slideText) {
            const slideNumber = slideFile.match(/slide(\d+)/)?.[1] || 'unknown';
            textParts.push(`\n=== Slide ${slideNumber} ===\n${slideText}`);
          }
        }
      } catch (slideError) {
        console.warn(`Error processing ${slideFile}:`, slideError);
      }
    }

    // Also try to extract from notes if available
    const notesFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/notesSlides/notesSlide') && name.endsWith('.xml')
    );

    for (const notesFile of notesFiles) {
      try {
        const notesContent = await zip.files[notesFile].async('text');
        const textMatches = notesContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
        if (textMatches) {
          const notesText = textMatches
            .map(match => match.replace(/<[^>]*>/g, '').trim())
            .filter(text => text.length > 0)
            .join(' ');
          
          if (notesText) {
            const slideNumber = notesFile.match(/notesSlide(\d+)/)?.[1] || 'unknown';
            textParts.push(`\n=== Slide ${slideNumber} Notes ===\n${notesText}`);
          }
        }
      } catch (notesError) {
        console.warn(`Error processing ${notesFile}:`, notesError);
      }
    }

    const result = textParts.join('\n');
    if (result.trim().length === 0) {
      throw new Error("No text content found in PowerPoint slides");
    }
    
    return result;
  } catch (error) {
    throw new Error(`PowerPoint extraction failed: ${error instanceof Error ? error.message : String(error)}`);
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
    console.error(`Failed to process PDF for namespace ${namespace}:`, errorMessage);
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
  console.log(`Starting ${documentType} processing for namespace: ${namespace}`);
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
    console.error(`Failed to process ${documentType} for namespace ${namespace}:`, errorMessage);
    return { numDocs: 0, success: false, error: errorMessage };
  }
};