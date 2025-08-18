import { TypeFile } from "./TypeSupabase";

export interface TypePricingTier {
  title?: string; // Optional title for the tier
  price: string;
  subtitle: string;
  features: string[];
  billingNote?: string;
}

export interface TypePricingData {
  annual: {
    free: TypePricingTier;
    personal: TypePricingTier;
    pro: TypePricingTier;
  };
  lifetime: {
    free: TypePricingTier;
    personal: TypePricingTier;
    pro: TypePricingTier;
  };
}

export type TypeFaqItem = {
  value: string;
  question: string;
  answer: string;
};

export type TypeSpreadsheetRow = (
  | string
  | number
  | boolean
  | null
  | undefined
)[];
export type TypeSpreadsheetData = TypeSpreadsheetRow[];

export interface TypeGeminiImageData {
  buffer: Buffer;
  mimeType: string;
}

export type TypeUploadFileParams = {
  file: File;
  fileData: Omit<TypeFile, "id" | "user_id" | "uploaded_at" | "url">;
};

export type TypeUpdateFileParams = {
  fileId: string;
  fileData: Partial<TypeFile>;
};