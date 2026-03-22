// types for the translate module

import { z } from "zod";

export const translateTextSchema = z.object({
  text: z.string().min(1).max(1000).trim(),
  sourceLang: z.string().default("autodetect"), // mymemory supports autodetect
  targetLang: z.string().min(2).max(10),
});

export type TranslateTextInput = z.infer<typeof translateTextSchema>;

// mymemory api response shape
export interface MyMemoryResponse {
  responseStatus: number;
  responseMessage: string;
  responseData: {
    translatedText: string;
    match: number;
  };
  matches?: Array<{
    translation: string;
    quality: number;
    "match": number;
  }>;
}
