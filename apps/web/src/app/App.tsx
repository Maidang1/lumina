import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/features/landing";
import { GalleryPage } from "@/features/gallery";
import { usePhotosCollection } from "@/features/photos/hooks/usePhotosCollection";

const App: React.FC = () => {
  const {
    photos,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePhotosCollection();

  const galleryProps = {
    photos,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage photos={photos} isLoading={isLoading} />}
      />

      <Route
        path="/gallery"
        element={<GalleryPage {...galleryProps} viewMode="gallery" />}
      />

      <Route
        path="/gallery/:photoId"
        element={<GalleryPage {...galleryProps} viewMode="gallery" />}
      />

      <Route
        path="/map"
        element={<GalleryPage {...galleryProps} viewMode="map" />}
      />

      <Route
        path="/map/:photoId"
        element={<GalleryPage {...galleryProps} viewMode="map" />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
