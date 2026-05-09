import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SongMetadata {
  lyrics: string;
  artistBio: string;
  genre: string;
  funFact: string;
}

export interface RecommendedSong {
  title: string;
  artist: string;
  reason: string;
}

export async function getSongMetadata(title: string, artist: string): Promise<SongMetadata> {
  const prompt = `Identify the song "${title}" by "${artist}". 
  Provide the song lyrics (if available/legal), a brief artist biography, the genre, and one fun fact about this song or artist.
  If you cannot find exact lyrics, provide a description of the song's meaning.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lyrics: { type: Type.STRING, description: "Full song lyrics or a detailed meaning description if lyrics unknown." },
            artistBio: { type: Type.STRING, description: "A concise biography of the artist." },
            genre: { type: Type.STRING, description: "The music genre." },
            funFact: { type: Type.STRING, description: "An interesting fact about the song or artist." },
          },
          required: ["lyrics", "artistBio", "genre", "funFact"],
        },
      },
    });

    return JSON.parse(response.text || "{}") as SongMetadata;
  } catch (error) {
    console.error("Gemini metadata error:", error);
    return {
      lyrics: "Search for lyrics on the web or let the music speak to you.",
      artistBio: "Unknown artist.",
      genre: "Unknown",
      funFact: "Music is the universal language of mankind."
    };
  }
}

export async function getSongRecommendations(history: { title: string, artist: string }[]): Promise<RecommendedSong[]> {
  const historyString = history.map(s => `"${s.title}" by ${s.artist}`).join(", ");
  const prompt = `Based on this listening history: ${historyString}, suggest 3 new songs the user might enjoy. 
  Provide the title, artist, and a brief one-sentence reason for the recommendation.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              artist: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["title", "artist", "reason"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]") as RecommendedSong[];
  } catch (error) {
    console.error("Gemini recommendation error:", error);
    return [];
  }
}
