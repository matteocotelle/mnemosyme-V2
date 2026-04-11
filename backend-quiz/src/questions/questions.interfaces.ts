export interface Question {
  id: string;
  question: string;
  answer: string; // For opinion type: "choixA|choixB"
  points: number;
  genre: string;
  type: 'text' | 'image' | 'opinion' | 'drawing';
  mediaUrl?: string;
  image?: string; // populated with public URL at runtime
}
