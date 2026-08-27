"use server";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { isPineconeConfigured } from "../pinecone";
import { processAndStoreDocuments } from "./embeddings-store";
import { extractWordText } from "./extractors/word-extractor";
import { extractExcelText } from "./extractors/excel-extractor";
import { extractPowerPointText } from "./extractors/powerpoint-extractor";

/**
 * Result of document processing operation.
 */
interface ProcessingResultType {
  numDocs: number;
  success: boolean;
  error?: string;
}

/**
 * Extracts text from various document types.
 */
async function extractTextFromGenericDocument(
  fileBlob: Blob,
  documentType: string,
): Promise<string> {
  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  switch (documentType) {
    case "doc":
    case "docs":
    case "docx":
      return extractWordText(buffer);

    case "sheet":
    case "sheets":
    case "xls":
    case "xlsx":
      return extractExcelText(buffer);

    case "slides":
    case "ppt":
    case "pptx":
      return extractPowerPointText(buffer);

    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

/**
 * Processes a PDF file by extracting its content and storing it as embeddings in Pinecone.
 * @param fileBlob - The PDF file blob
 * @param namespace - The unique ID for the file
 */
export async function processPdfDocument(
  fileBlob: Blob,
  namespace: string,
): Promise<ProcessingResultType> {
  if (!(await isPineconeConfigured())) {
    return { success: false, numDocs: 0, error: "Pinecone is not configured." };
  }

  try {
    const loader = new PDFLoader(fileBlob);
    const docs = await loader.load();
    const { numDocs } = await processAndStoreDocuments(docs, namespace);
    return { numDocs, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { numDocs: 0, success: false, error: errorMessage };
  }
}

/**
 * Processes a generic document (Word, Excel, PowerPoint) by extracting its text and storing embeddings.
 * @param fileBlob - The document file blob
 * @param namespace - The unique ID for the file
 * @param documentType - The type of the document
 */
export async function processGenericDocument(
  fileBlob: Blob,
  namespace: string,
  documentType: string,
): Promise<ProcessingResultType> {
  if (!(await isPineconeConfigured())) {
    return { success: false, numDocs: 0, error: "Pinecone is not configured." };
  }

  try {
    const text = await extractTextFromGenericDocument(fileBlob, documentType);
    const doc = new Document({
      pageContent: text,
      metadata: { source: namespace, type: documentType },
    });

    const { numDocs } = await processAndStoreDocuments([doc], namespace);
    return { numDocs, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { numDocs: 0, success: false, error: errorMessage };
  }
}
