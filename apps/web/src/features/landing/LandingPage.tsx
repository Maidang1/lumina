import React from "react";
import HeroSection from "./components/HeroSection";
import StatsOverview from "./components/StatsOverview";
import CollectionsPreview from "./components/CollectionsPreview";
import { LoadingSpinner } from "@/shared/components";
import type { Photo } from "@/features/photos/types";

interface LandingPageProps {
  photos: Photo[];
  isLoading: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ photos, isLoading }) => {
  const featuredPhotos = photos.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lumina-bg">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lumina-bg">
      <HeroSection featuredPhotos={featuredPhotos} />
      {photos.length > 0 && (
        <>
          <StatsOverview photos={photos} />
          <CollectionsPreview photos={photos} />
        </>
      )}
    </div>
  );
};

export default LandingPage;
