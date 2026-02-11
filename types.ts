export interface ExifData {
  camera: string;
  lens: string;
  iso: number;
  aperture: string;
  shutter: string;
  focalLength: string;
  date: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  location: string;
  category: string;
  width: number;
  height: number;
  visualDescription: string; // Used for AI context
  exif: ExifData;
}

export interface AiAnalysis {
  loading: boolean;
  content: string | null;
  error: string | null;
}
