import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ScrollProgress } from "@/shared/magicui/scroll-progress";
import { AnimatedGridPattern } from "@/shared/magicui/animated-grid-pattern";
import { Header } from "@/shared/components/Header";
import { LandingPage } from "@/features/landing";
import { GalleryView } from "@/features/gallery";
import { usePhotosCollection } from "@/features/photos/hooks/usePhotosCollection";

const GalleryLayout: React.FC<{
  children: React.ReactNode;
  photoCount: number;
}> = ({ children, photoCount }) => {
  return (
    <div className="relative min-h-screen bg-lumina-bg text-lumina-text">
      <ScrollProgress />
      <div className="pointer-events-none fixed inset-0 z-0">
        <AnimatedGridPattern
          className="opacity-25"
          numSquares={35}
          maxOpacity={0.35}
          duration={5}
          repeatDelay={1}
        />
      </div>
      <Header photoCount={photoCount} />
      {children}
    </div>
  );
};

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

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage photos={photos} isLoading={isLoading} />}
      />

      <Route
        path="/gallery"
        element={
          <GalleryLayout photoCount={photos.length}>
            <GalleryView
              photos={photos}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              error={error}
              hasMore={hasMore}
              loadMore={loadMore}
              refresh={refresh}
              viewMode="gallery"
            />
          </GalleryLayout>
        }
      />

      <Route
        path="/gallery/:photoId"
        element={
          <GalleryLayout photoCount={photos.length}>
            <GalleryView
              photos={photos}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              error={error}
              hasMore={hasMore}
              loadMore={loadMore}
              refresh={refresh}
              viewMode="gallery"
            />
          </GalleryLayout>
        }
      />

      <Route
        path="/map"
        element={
          <GalleryLayout photoCount={photos.length}>
            <GalleryView
              photos={photos}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              error={error}
              hasMore={hasMore}
              loadMore={loadMore}
              refresh={refresh}
              viewMode="map"
            />
          </GalleryLayout>
        }
      />

      <Route
        path="/map/:photoId"
        element={
          <GalleryLayout photoCount={photos.length}>
            <GalleryView
              photos={photos}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              error={error}
              hasMore={hasMore}
              loadMore={loadMore}
              refresh={refresh}
              viewMode="map"
            />
          </GalleryLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
