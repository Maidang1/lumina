import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/shared/components/Header";
import { ScrollProgress } from "@/shared/magicui/scroll-progress";
import { AnimatedGridPattern } from "@/shared/magicui/animated-grid-pattern";

interface MainLayoutProps {
  photoCount?: number;
  toolbar?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ photoCount = 0, toolbar }) => {
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

      <Header photoCount={photoCount} toolbar={toolbar} />

      <Outlet />
    </div>
  );
};

export default MainLayout;
