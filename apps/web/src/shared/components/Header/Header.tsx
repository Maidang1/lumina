import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Camera, MapPin, Images } from "lucide-react";

interface HeaderProps {
  photoCount?: number;
  variant?: "default" | "transparent";
  toolbar?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  photoCount = 0,
  variant = "default",
  toolbar,
}) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isGallery = currentPath === "/gallery" || currentPath.startsWith("/gallery/");
  const isMap = currentPath === "/map" || currentPath.startsWith("/map/");

  const headerBg =
    variant === "transparent"
      ? "bg-transparent"
      : "bg-gradient-to-b from-black/80 via-black/60 to-transparent backdrop-blur-sm";

  return (
    <header className={`sticky top-0 z-30 w-full ${headerBg}`}>
      <div className="flex h-14 items-center justify-between px-4 sm:h-16 sm:px-8">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/90 to-orange-500/90 shadow-lg shadow-amber-500/20">
              <Camera size={16} className="text-black" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-medium leading-none tracking-tight text-white sm:text-xl">
                Lumina
              </span>
              <span className="hidden text-[9px] font-medium uppercase tracking-[0.2em] text-white/40 sm:block">
                Photography
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/gallery" active={isGallery} icon={<Images size={15} />}>
              Gallery
            </NavLink>
            <NavLink to="/map" active={isMap} icon={<MapPin size={15} />}>
              Map
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {photoCount > 0 && (
            <div className="hidden items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 sm:flex">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
                Collection
              </span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {photoCount}
              </span>
            </div>
          )}

          <nav className="flex items-center gap-1 sm:hidden">
            <MobileNavLink to="/gallery" active={isGallery} icon={<Images size={18} />} />
            <MobileNavLink to="/map" active={isMap} icon={<MapPin size={18} />} />
          </nav>
        </div>
      </div>

      {toolbar && (
        <div className="border-t border-white/[0.05] bg-black/20 px-4 py-2.5 backdrop-blur-md sm:px-8">
          {toolbar}
        </div>
      )}
    </header>
  );
};

interface NavLinkProps {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, active, icon, children }) => {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-white/[0.12] text-white shadow-sm"
          : "text-white/60 hover:bg-white/[0.06] hover:text-white/90"
      }`}
    >
      <span className={`transition-colors ${active ? "text-amber-400" : "text-white/40 group-hover:text-white/70"}`}>
        {icon}
      </span>
      {children}
    </Link>
  );
};

interface MobileNavLinkProps {
  to: string;
  active: boolean;
  icon: React.ReactNode;
}

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ to, active, icon }) => {
  return (
    <Link
      to={to}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
        active
          ? "bg-white/[0.12] text-amber-400"
          : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
      }`}
    >
      {icon}
    </Link>
  );
};

export default Header;
