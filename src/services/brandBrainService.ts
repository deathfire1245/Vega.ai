import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface BrandBrain {
  brandName: string;
  brandDescription: string;
  tone: string[];
  targetAudience: string;
  contentPillars: string[];
  discordConnected?: boolean;
  discordUserId?: string;
  discordUsername?: string;
  deliveryChannel?: 'discord' | 'telegram' | 'both';
  telegramChatId?: string;
}

/**
 * Builds a system prompt from the brand brain structure.
 */
export function generateSystemPrompt(brand: BrandBrain): string {
  const toneStr = brand.tone.join(', ');
  const pillarsStr = brand.contentPillars.join(', ');
  
  return `You are a content strategist for ${brand.brandName}. ${brand.brandDescription}. Tone: ${toneStr}. Target audience: ${brand.targetAudience}. Content pillars: ${pillarsStr}. Always write in this brand's voice.`;
}

/**
 * Fetches the Brand Brain document for a specific user.
 * Assumes the document is located at /users/{uid}/brandBrain/current
 */
export async function getBrandBrain(uid: string): Promise<BrandBrain | null> {
  const path = `users/${uid}/brandBrain/current`;
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as BrandBrain;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch Brand Brain:", error);
    return null;
  }
}
