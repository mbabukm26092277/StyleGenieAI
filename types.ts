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

export interface HistoryItem {
  id: string;
  image: string;
  styleName: string;
  description: string;
  type: 'hair' | 'fashion' | 'mix';
  items: StyleItem[]; // The items used to generate this (1 or 2 items)
  timestamp: number;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
    snippet?: string;
  };
  // Keeping maps definition for potential future use or type compatibility
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

export type SubscriptionTier = 'free' | 'monthly' | 'yearly' | 'lifetime';

export interface UserUsage {
  installDate: number;       // Timestamp when user first visited
  lastUsedDate: string;      // Date string to track daily resets
  dailyCount: number;        // Styles generated today
  extraDailyLimit: number;   // Added via "Day Pass" (Option 1)
  tier: SubscriptionTier;
}