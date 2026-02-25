import React from "react";
import { ArrowLeft } from "lucide-react";

const ManageHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px]">
      <div className="mx-auto flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#080808]/90 px-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:h-20 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-white/40 transition-colors duration-200 hover:text-white/75"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="hidden h-3 w-px bg-white/[0.08] sm:block" />
          <span className="truncate font-serif text-xl tracking-tight text-white sm:text-2xl">Photo Library</span>
        </div>
      </div>
    </header>
  );
};

export default ManageHeader;
