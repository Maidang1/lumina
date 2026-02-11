import React from 'react';

const Histogram: React.FC = () => {
  // Generates a random-looking but smooth histogram path
  const generatePath = () => {
    let d = "M0 50 ";
    const points = 20;
    for (let i = 1; i <= points; i++) {
        const x = (i / points) * 100;
        // Random height between 5 and 50
        const y = 50 - Math.random() * 45; 
        d += `L${x} ${y} `;
    }
    d += "L100 50 Z";
    return d;
  };
  
  // Memoize path to avoid re-render flicker
  const rPath = React.useMemo(() => generatePath(), []);
  const gPath = React.useMemo(() => generatePath(), []);
  const bPath = React.useMemo(() => generatePath(), []);
  const wPath = React.useMemo(() => generatePath(), []);

  return (
    <div className="w-full h-24 bg-pro-gray/50 rounded p-2 relative overflow-hidden">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full opacity-80 mix-blend-screen">
        <path d={rPath} fill="red" fillOpacity="0.4" />
        <path d={gPath} fill="green" fillOpacity="0.4" />
        <path d={bPath} fill="blue" fillOpacity="0.4" />
        <path d={wPath} fill="white" fillOpacity="0.2" />
      </svg>
      <div className="absolute top-0 left-0 w-full h-full border border-white/10 rounded pointer-events-none"></div>
      
      {/* Grid lines */}
      <div className="absolute top-0 left-1/4 h-full w-px bg-white/10"></div>
      <div className="absolute top-0 left-2/4 h-full w-px bg-white/10"></div>
      <div className="absolute top-0 left-3/4 h-full w-px bg-white/10"></div>
    </div>
  );
};

export default Histogram;
