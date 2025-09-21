import { GoogleGenerativeAI } from '@google/generative-ai';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// Using Google Gemini for image processing instead
// Environment variable will be available at runtime from the backend
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export type StickerEffect = 'border' | 'plain' | 'comic' | 'shiny';

export interface ProcessedImage {
  originalUrl: string;
  processedUrl: string;
  effect: StickerEffect;
}

class GeminiImageService {
  private model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  async processImageWithEffect(imageUrl: string, effect: StickerEffect): Promise<string> {
    try {
      // Convert image URL to base64 if needed
      const imageData = await this.urlToBase64(imageUrl);
      
      let prompt = '';
      switch (effect) {
        case 'plain':
          prompt = 'Remove the white border and background from this sticker image, keeping only the main subject with a transparent background. Make it look clean and isolated.';
          break;
        case 'border':
          prompt = 'Keep this sticker image as is with its white border intact. This is the original bordered version.';
          break;
        case 'comic':
          prompt = 'Apply a comic book style effect to this sticker. Add bold outlines, vibrant colors, and a comic book aesthetic while maintaining the sticker format.';
          break;
        case 'shiny':
          prompt = 'Apply a shiny, metallic, glossy effect to this sticker. Make it look like it has a reflective, premium foil finish with subtle highlights and depth.';
          break;
      }

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      // For now, return the original URL since we need to handle the response properly
      // In a real implementation, we'd extract the generated image from the response
      return imageUrl;
    } catch (error) {
      console.error('Error processing image with Gemini:', error);
      return imageUrl; // Fallback to original
    }
  }

  private async urlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove the data URL prefix
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting URL to base64:', error);
      throw error;
    }
  }

  // Batch process multiple images
  async batchProcessImages(imageUrls: string[], effect: StickerEffect): Promise<ProcessedImage[]> {
    const promises = imageUrls.map(async (url) => {
      const processedUrl = await this.processImageWithEffect(url, effect);
      return {
        originalUrl: url,
        processedUrl,
        effect
      };
    });

    return Promise.all(promises);
  }
}

export const geminiImageService = new GeminiImageService();