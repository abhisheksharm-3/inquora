/**
 * pdf-parse ships no types and has no @types package. It is here as the peer
 * dependency of @langchain/community's PDFLoader, and this is the one function
 * used from it.
 */
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }

  const parse: (data: Buffer | Uint8Array) => Promise<PdfParseResult>;
  export default parse;
}
