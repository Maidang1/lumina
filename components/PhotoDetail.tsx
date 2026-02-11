import React, { useEffect, useState } from 'react';
import { Photo, AiAnalysis } from '../types';
import { X, Aperture, Timer, Gauge, MapPin, Calendar, Camera, Sparkles, ChevronRight, Download } from 'lucide-react';
import Histogram from './Histogram';
import { generatePhotoCritique } from '../services/geminiService';

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
}

const PhotoDetail: React.FC<PhotoDetailProps> = ({ photo, onClose }) => {
  const [analysis, setAnalysis] = useState<AiAnalysis>({
    loading: false,
    content: null,
    error: null,
  });

  const handleAnalysis = async () => {
    setAnalysis({ loading: true, content: null, error: null });
    const result = await generatePhotoCritique(photo);
    setAnalysis({ loading: false, content: result, error: null });
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm overflow-hidden">
        
      {/* Main Container */}
      <div className="w-full h-full flex flex-col md:flex-row relative">
        
        {/* Close Button Mobile */}
        <button 
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white"
        >
          <X size={24} />
        </button>

        {/* Left: Image Area */}
        <div className="flex-1 relative flex items-center justify-center bg-black p-4 md:p-8 h-[60%] md:h-full">
            <button 
                onClick={onClose}
                className="hidden md:block absolute top-6 left-6 text-white/50 hover:text-white transition-colors z-20"
            >
                <div className="flex items-center gap-2 text-sm uppercase tracking-widest">
                    <X size={20} />
                    <span>Close Gallery</span>
                </div>
            </button>

            <img 
                src={photo.url} 
                alt={photo.title}
                className="max-w-full max-h-full object-contain shadow-2xl"
            />
        </div>

        {/* Right: Info Panel */}
        <div className="w-full md:w-[400px] lg:w-[450px] bg-pro-gray/90 border-l border-white/5 flex flex-col h-[40%] md:h-full overflow-y-auto no-scrollbar backdrop-blur-md">
            
            <div className="p-8 space-y-8">
                {/* Header */}
                <div>
                    <h2 className="font-serif text-3xl text-white mb-2">{photo.title}</h2>
                    <div className="flex items-center text-gray-400 text-sm gap-4">
                        <span className="flex items-center gap-1.5"><MapPin size={14} /> {photo.location}</span>
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {photo.exif.date}</span>
                    </div>
                </div>

                {/* Histogram */}
                <div>
                    <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3 font-semibold">Histogram</h3>
                    <Histogram />
                </div>

                {/* EXIF Grid */}
                <div>
                    <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-semibold">Shot Parameters</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-black/40 rounded border border-white/5 hover:border-accent/50 transition-colors group">
                            <div className="flex items-center gap-2 text-gray-400 mb-1">
                                <Aperture size={16} className="group-hover:text-accent transition-colors"/>
                                <span className="text-xs uppercase tracking-wider">Aperture</span>
                            </div>
                            <span className="text-lg font-mono text-white">{photo.exif.aperture}</span>
                        </div>

                        <div className="p-4 bg-black/40 rounded border border-white/5 hover:border-accent/50 transition-colors group">
                             <div className="flex items-center gap-2 text-gray-400 mb-1">
                                <Timer size={16} className="group-hover:text-accent transition-colors"/>
                                <span className="text-xs uppercase tracking-wider">Shutter</span>
                            </div>
                            <span className="text-lg font-mono text-white">{photo.exif.shutter}</span>
                        </div>

                        <div className="p-4 bg-black/40 rounded border border-white/5 hover:border-accent/50 transition-colors group">
                             <div className="flex items-center gap-2 text-gray-400 mb-1">
                                <Gauge size={16} className="group-hover:text-accent transition-colors"/>
                                <span className="text-xs uppercase tracking-wider">ISO</span>
                            </div>
                            <span className="text-lg font-mono text-white">{photo.exif.iso}</span>
                        </div>

                        <div className="p-4 bg-black/40 rounded border border-white/5 hover:border-accent/50 transition-colors group">
                             <div className="flex items-center gap-2 text-gray-400 mb-1">
                                <Camera size={16} className="group-hover:text-accent transition-colors"/>
                                <span className="text-xs uppercase tracking-wider">Focal Len</span>
                            </div>
                            <span className="text-lg font-mono text-white">{photo.exif.focalLength}</span>
                        </div>
                    </div>
                </div>

                {/* Gear Info */}
                <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-400">Camera Body</span>
                        <span className="text-sm text-white font-medium">{photo.exif.camera}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-400">Lens</span>
                        <span className="text-sm text-white font-medium">{photo.exif.lens}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                         <span className="text-sm text-gray-400">Resolution</span>
                        <span className="text-sm text-white font-medium">{photo.width} × {photo.height}</span>
                    </div>
                </div>

                {/* AI Analysis Section */}
                <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs uppercase tracking-widest text-gray-500 font-semibold flex items-center gap-2">
                            <Sparkles size={14} className="text-accent"/> Curator AI
                        </h3>
                    </div>

                    {!analysis.content && !analysis.loading && (
                        <button 
                            onClick={handleAnalysis}
                            className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 group"
                        >
                            <span>Generate Artistic Analysis</span>
                            <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all"/>
                        </button>
                    )}

                    {analysis.loading && (
                         <div className="w-full py-8 flex flex-col items-center justify-center text-gray-500 gap-3">
                            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs uppercase tracking-wide">Analyzing Composition...</span>
                         </div>
                    )}

                    {analysis.content && (
                        <div className="bg-gradient-to-br from-white/5 to-transparent p-6 rounded border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-accent/50"></div>
                            <p className="text-gray-300 leading-relaxed font-serif italic text-sm">
                                "{analysis.content}"
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-8 mt-auto">
                    <button className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-semibold uppercase tracking-widest text-xs hover:bg-gray-200 transition-colors">
                        <Download size={16} /> Download Original
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoDetail;