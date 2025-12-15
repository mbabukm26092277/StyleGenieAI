import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Coordinates, GroundingChunk } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";

// Custom Search Configuration
const CSE_ID = process.env.SEARCH_ENGINE_ID;
const API_KEY = process.env.API_KEY;

/**
 * Analyzes the user's photo to suggest hair and clothing styles.
 */
export const analyzeImageAndSuggestStyles = async (
  base64Image: string, 
  requestType: 'initial' | 'more_hair' | 'more_fashion' | 'custom' = 'initial',
  customQuery?: string
): Promise<AnalysisResult> => {
  let styleRequest = "";
  
  if (requestType === 'custom' && customQuery) {
    styleRequest = `suggest 5 hairstyles and 5 fashion outfit styles that match this specific request: "${customQuery}". If the request is about hair, focus on hair; if fashion, focus on fashion.`;
  } else if (requestType === 'more_hair') {
    styleRequest = "suggest 10 MORE DIFFERENT suitable hairstyles and 1 outfit style";
  } else if (requestType === 'more_fashion') {
    styleRequest = "suggest 1 hairstyle and 10 MORE DIFFERENT trendy fashion outfit styles";
  } else {
    // Initial request
    styleRequest = "suggest 10 suitable hairstyles and 10 trendy fashion outfit styles";
  }

  const prompt = `
    Analyze the person in this image. Identify their face shape and skin tone.
    Based on this analysis, ${styleRequest} that would flatter them.
    
    SAFETY GUIDELINES:
    1. STRICTLY PROHIBIT any suggestions that are sexually explicit, nude, vulgar, or inappropriate.
    2. All fashion suggestions must be modest and suitable for a general audience.
    3. If the user's custom request implies nudity or inappropriateness, ignore it and provide safe, trendy alternatives.
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          faceShape: { type: Type.STRING },
          skinTone: { type: Type.STRING },
          hairStyles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          outfits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to analyze image");
  }

  return JSON.parse(response.text) as AnalysisResult;
};

/**
 * Extracts a visual description of a fashion item from a URL using Google Search Grounding.
 */
export const getOutfitDescriptionFromUrl = async (url: string): Promise<string> => {
  const prompt = `
    Visit this URL or search for this product link: ${url}. 
    Describe the main clothing item found there in detailed visual terms so it can be recreated (color, fabric, cut, length, style). 
    Focus ONLY on the clothing item.
    
    SAFETY CHECK: If the item at the link is inappropriate, nude, or lingerie, return "INVALID_SAFETY".
  `;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text || text.includes("INVALID_SAFETY")) {
    throw new Error("Could not retrieve a safe description from this link.");
  }
  return text;
};

/**
 * Generates a visualization of a specific style on the user.
 */
export const visualizeStyle = async (base64Image: string, styleDescription: string, type: 'hair' | 'fashion' | 'mix'): Promise<string> => {
  let prompt = "";

  if (type === 'hair') {
    prompt = `Change the person's hairstyle to ${styleDescription}. Keep their face and expression exactly the same. Only change the hair. Ensure the image is photorealistic, professional, and safe for all audiences.`;
  } else if (type === 'fashion') {
    prompt = `Change the person's clothing to ${styleDescription}. Keep their face, head, and background exactly the same. High fashion photography style. SAFETY WARNING: The output MUST BE FULLY CLOTHED and MODEST.`;
  } else if (type === 'mix') {
    prompt = `Change the person's hairstyle AND clothing. ${styleDescription} Keep their face, expression and skin tone exactly the same. High fashion photography style. SAFETY WARNING: The output MUST BE FULLY CLOTHED and MODEST.`;
  }

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        { text: prompt },
      ],
    },
  });

  // Extract image from response parts
  const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  
  if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }
  
  throw new Error("Failed to generate image visualization");
};

/**
 * Helper to perform search using Google Programmable Search Engine API (Custom Search JSON API).
 */
const performCustomSearch = async (query: string): Promise<GroundingChunk[]> => {
  if (!CSE_ID) {
    console.warn("SEARCH_ENGINE_ID is not set in environment variables.");
    return [{ 
      web: { 
        uri: "#", 
        title: "Configuration Missing", 
        snippet: "Please set SEARCH_ENGINE_ID in your environment variables to enable search results." 
      } 
    }];
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.items && Array.isArray(data.items)) {
      return data.items.map((item: any) => ({
        web: {
          uri: item.link,
          title: item.title,
          snippet: item.snippet
        }
      }));
    }
    return [];
  } catch (error) {
    console.error("Custom Search API Error:", error);
    return [{ 
      web: { 
        uri: "#", 
        title: "Search Error", 
        snippet: "Unable to fetch search results at this time." 
      } 
    }];
  }
};

/**
 * Finds nearby salons using Google Maps Grounding.
 */
export const findNearbySalons = async (location: Coordinates): Promise<{ text: string, chunks: GroundingChunk[] }> => {
  const prompt = `Find top rated hair salons nearby.`;
  
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          // @ts-ignore: retrievalConfig is supported but might not be in the strict types yet
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        }
      }
    });

    const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as GroundingChunk[];
    const text = response.text || "Here are some top-rated salons found near your location.";
    
    return {
      text,
      chunks
    };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return {
      text: "Unable to find salons at this moment.",
      chunks: []
    };
  }
};

/**
 * Finds shopping links using Google Programmable Search Engine.
 */
export const findShoppingLinks = async (query: string): Promise<{ text: string, chunks: GroundingChunk[] }> => {
  // We append "buy online" to ensure we get shopping results
  const searchTerms = `buy online ${query}`;
  const chunks = await performCustomSearch(searchTerms);
  
  return {
    text: chunks.length > 0 ? "Here are some shopping options found on the web:" : "No products found. Please try a different style.",
    chunks: chunks
  };
};