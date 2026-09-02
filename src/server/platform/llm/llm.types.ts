export interface ModelConfig {
  apiKey?: string;
  /** provider:model, for example google-genai:gemini-2.5-flash. */
  model?: string;
  temperature?: number;
}
