export interface AnalysisResult {
  faceShape: string;
  skinTone: string;
  hairStyles: StyleItem[];
  outfits: StyleItem[];
}

export interface StyleItem {
  name: string;
  description: string;
  thumbnail?: string;     // Base64 image for the preview icon
  selectedColor?: string; // Selected color name (e.g., "Red", "Blue")
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
    snippet?: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        content: string;
      }[];
    }[];
  };
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}