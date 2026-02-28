import React from "react";
import { Link, useLocation } from "react-router-dom";
import { NumberTicker } from "@/shared/magicui/number-ticker";

interface HeaderProps {
  photoCount?: number;
  variant?: "default" | "transparent";
}

const Header: React.FC<HeaderProps> = ({
  photoCount = 0,
  variant = "default",
}) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isGallery = currentPath === "/gallery" || currentPath.startsWith("/gallery/");
  const isMap = currentPath === "/map" || currentPath.startsWith("/map/");

  const navLinkClass = (active: boolean) =>
    `cursor-pointer rounded-md px-3 py-1.5 transition-colors duration-200 ${
      active ? "bg-white/12 text-white" : "text-white/45 hover:text-white/75"
    }`;

  const headerBg =
    variant === "transparent"
      ? "bg-transparent border-transparent"
      : "border-white/[0.12] bg-[#080b10]/82 backdrop-blur-xl shadow-[var(--shadow-elevation-3)]";

  return (
    <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px] px-2 sm:px-4">
      <div
        className={`mx-auto mt-2 flex h-16 items-center justify-between rounded-xl border px-4 sm:mt-3 sm:h-20 sm:px-8 ${headerBg}`}
      >
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            to="/"
            className="font-display text-2xl tracking-tight text-lumina-text sm:text-3xl hover:opacity-80 transition-opacity"
          >
            Lumina
          </Link>
          <div className="hidden h-3 w-px bg-lumina-border sm:block" />
          <span className="hidden pt-0.5 font-mono text-xs tracking-wider text-lumina-muted uppercase sm:inline">
            Portfolio
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
          {photoCount > 0 && (
            <div className="hidden items-center gap-3 text-xs text-lumina-text-secondary sm:flex">
              <span className="uppercase">Photos</span>
              <NumberTicker
                value={photoCount}
                className="text-sm text-lumina-text"
              />
            </div>
          )}
          <nav className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 text-sm font-medium sm:gap-1">
            <Link to="/gallery" className={navLinkClass(isGallery)}>
              Gallery
            </Link>
            <Link to="/map" className={navLinkClass(isMap)}>
              Map
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
