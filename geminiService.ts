// Rely on the types provided by the installed @google/generative-ai package
// and remove the local ambient declaration to avoid duplicate identifier errors.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisResult, Coordinates, GroundingChunk } from "../types";

// Initial declarations removed to avoid redeclaring block-scoped variables;
// the API key, client and model constants are declared later after the
// import.meta.env typings to keep a single source of truth.


// Provide a local declaration for import.meta.env so TS knows about VITE_* env vars
declare global {
  interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY?: string;
    readonly VITE_SEARCH_ENGINE_ID?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// ✅ VITE_ prefix for browser
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) throw new Error("VITE_GEMINI_API_KEY missing from .env");

const genAI = new GoogleGenerativeAI(apiKey);  // ✅ Correct client

// Models
const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash";  // Fixed model name

// Custom Search Configuration
const CSE_ID = import.meta.env.VITE_SEARCH_ENGINE_ID || "";
const API_KEY = apiKey;  // Reuse for search

// Rest of your functions stay EXACTLY the same...
export const analyzeImageAndSuggestStyles = async (
  base64Image: string,
  requestType: 'initial' | 'more_hair' | 'more_fashion' | 'custom' = 'initial',
  customQuery?: string
): Promise<AnalysisResult> => {
  // ... your existing code unchanged
  // Return a rejected promise to satisfy the declared return type until the function is implemented.
  return Promise.reject(new Error("analyzeImageAndSuggestStyles not implemented"));
};

// ... all other functions unchanged
