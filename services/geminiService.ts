import { GoogleGenAI } from "@google/genai";
import { Photo } from "../types";

const apiKey = process.env.API_KEY || '';

// We reuse the client if possible
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export const generatePhotoCritique = async (photo: Photo): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `
      You are a world-class photography critic and curator. 
      Analyze the following photograph description and technical details.
      Provide a sophisticated, artistic critique of the image (approx 80 words).
      Focus on composition, lighting, and how the technical settings (EXIF) support the artistic intent.
      
      Title: ${photo.title}
      Visual Description: ${photo.visualDescription}
      Camera: ${photo.exif.camera}
      Lens: ${photo.exif.lens}
      Aperture: ${photo.exif.aperture}
      ISO: ${photo.exif.iso}
      Shutter Speed: ${photo.exif.shutter}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Analysis unavailable.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate critique at this moment. Please verify API configuration.";
  }
};
