export type InfoPanelTab = "info" | "exif" | "location";

export interface InfoTabData {
  filename: string;
  format: string;
  dimensions: string;
  fileSize: string;
  category: string;
  captureTime: string;
  description: string;
  tags: string[];
}

export interface ExifTabData {
  camera: { make: string; model: string };
  lens: string;
  focalLength: string;
  aperture: string;
  shutterSpeed: string;
  iso: number;
  exposureMode: string;
  whiteBalance: string;
  flash: boolean;
  software: string;
}

export interface LocationTabData {
  coordinates: { lat: number; lng: number } | null;
  address: string;
}
