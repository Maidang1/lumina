import React, { useState } from 'react';
import { MOCK_PHOTOS } from './constants';
import { Photo } from './types';
import PhotoGrid from './components/PhotoGrid';
import PhotoDetail from './components/PhotoDetail';
import { Aperture, Instagram, Twitter, Mail } from 'lucide-react';

const App: React.FC = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  return (
    <div className="min-h-screen bg-pro-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-pro-black/80 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white text-black flex items-center justify-center rounded-sm">
                <Aperture size={24} />
            </div>
            <div>
                <h1 className="font-serif text-2xl tracking-tight font-bold text-white">Lumina</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Portfolio</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Gallery</a>
            <a href="#" className="hover:text-white transition-colors">Series</a>
            <a href="#" className="hover:text-white transition-colors">About</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </nav>

          <button className="md:hidden text-white">
            <span className="sr-only">Menu</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </header>

      {/* Hero Section (Simple) */}
      <section className="py-20 md:py-32 text-center px-4">
        <h2 className="font-serif text-4xl md:text-6xl text-white mb-6">Capturing the Unseen</h2>
        <p className="text-gray-400 max-w-xl mx-auto text-lg leading-relaxed font-light">
          A collection of moments frozen in time, exploring the interplay of light, shadow, and emotion through the lens of a professional observer.
        </p>
      </section>

      {/* Main Gallery */}
      <main className="flex-grow">
        <PhotoGrid 
          photos={MOCK_PHOTOS} 
          onPhotoClick={setSelectedPhoto} 
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-12 bg-pro-gray">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Lumina Photography. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-400 hover:text-white transition-colors"><Instagram size={20} /></a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter size={20} /></a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors"><Mail size={20} /></a>
          </div>
        </div>
      </footer>

      {/* Detail Modal */}
      {selectedPhoto && (
        <PhotoDetail 
          photo={selectedPhoto} 
          onClose={() => setSelectedPhoto(null)} 
        />
      )}
    </div>
  );
};

export default App;
