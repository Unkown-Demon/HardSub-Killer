import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Play, Pause, CheckCircle, AlertCircle, FileText, Download, Activity, Trash2 } from 'lucide-react';
import { ROISelector } from './components/ROISelector';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface OCRResult {
  timestamp: number;
  text: string;
  confidence: number;
}

export default function App() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [roi, setRoi] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideo(file);
      setVideoUrl(URL.createObjectURL(file));
      setResults([]);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (!video) return;
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('video', video);
    if (roi) formData.append('roi', JSON.stringify(roi));

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Processing failed');

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSRT = () => {
    const srt = results.map((res, i) => {
      const start = new Date(res.timestamp).toISOString().substr(11, 12).replace('.', ',');
      const end = new Date(res.timestamp + 1000).toISOString().substr(11, 12).replace('.', ',');
      return `${i + 1}\n${start} --> ${end}\n${res.text}\n`;
    }).join('\n');

    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#e0f2fe] bg-gradient-to-br from-[#648cc4] via-[#e0f2fe] to-[#ffffff] font-sans text-slate-800 overflow-x-hidden">
      {/* Glossy Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/30 border-b border-white/40 shadow-lg px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-cyan-300 rounded-full shadow-inner flex items-center justify-center border border-white/50">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-700 drop-shadow-sm">
            Hardsub-Killer <span className="text-blue-600 font-light italic">Vorex Engine</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-1 rounded-full bg-white/50 border border-white/60 text-xs font-semibold text-blue-700 uppercase tracking-widest shadow-sm">
            Intel UHD 630 Optimized
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Video & Controls */}
        <div className="lg:col-span-7 space-y-6">
          <section className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/60 bg-black group">
            {videoUrl ? (
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onClick={togglePlay}
                />
                {!isProcessing && (
                  <ROISelector onSelect={setRoi} videoRef={videoRef} />
                )}
                
                {/* Custom Minimal Controls Overlay */}
                <div className="absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/40 transition-all"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  
                  {roi && (
                    <button 
                      onClick={() => setRoi(null)}
                      className="px-4 py-2 rounded-full bg-red-500/80 backdrop-blur-md border border-red-400/50 flex items-center gap-2 text-white text-xs font-bold hover:bg-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear ROI
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900 text-slate-400">
                <Upload className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium opacity-50">Drop video to begin extraction</p>
              </div>
            )}
            
            {/* Glossy Overlay for Processing */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 backdrop-blur-xl bg-blue-500/10 flex flex-col items-center justify-center"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-blue-400/30 border-t-blue-500 rounded-full animate-spin shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                    <Activity className="absolute inset-0 m-auto text-blue-500 w-8 h-8 animate-pulse" />
                  </div>
                  <p className="mt-6 text-blue-700 font-bold text-xl tracking-widest uppercase animate-pulse">
                    Analyzing Frames...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Control Panel */}
          <div className="grid grid-cols-2 gap-4">
            <label className="relative group cursor-pointer">
              <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              <div className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-b from-white to-[#f0f9ff] border border-white shadow-[0_4px_10px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all active:scale-95">
                <Upload className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-slate-700">Load Video</span>
              </div>
            </label>

            <button
              onClick={startProcessing}
              disabled={!video || isProcessing}
              className={cn(
                "flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg",
                video && !isProcessing
                  ? "bg-gradient-to-b from-blue-400 to-blue-600 text-white border-t border-blue-300 hover:brightness-110"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              <Play className="w-5 h-5" />
              <span>Execute Extraction</span>
            </button>
          </div>

          {roi && (
            <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center gap-3 text-green-700 shadow-sm">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Adaptive ROI Defined: {roi.w}x{roi.h} at ({roi.x}, {roi.y})</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 shadow-sm">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Right Column: Results & Confidence */}
        <div className="lg:col-span-5 space-y-6">
          {/* Confidence Visualizer */}
          <section className="p-6 rounded-3xl bg-white/40 backdrop-blur-md border border-white/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Confidence Score
              </h3>
              {results.length > 0 && (
                <button
                  onClick={downloadSRT}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  SRT
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {results.length > 0 ? (
                results.map((res, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-2xl bg-white/60 border border-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                        PTS: {(res.timestamp / 1000).toFixed(3)}s
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              res.confidence > 80 ? "bg-green-400" : res.confidence > 50 ? "bg-yellow-400" : "bg-red-400"
                            )}
                            style={{ width: `${res.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{res.confidence}%</span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">
                      {res.text}
                    </p>
                  </motion.div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 opacity-30 italic">
                  <FileText className="w-12 h-12 mb-2" />
                  <p>No extraction data yet</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="mt-12 p-8 text-center text-slate-400 text-xs font-medium tracking-[0.2em] uppercase">
        Built with <span className="text-blue-400">Vorex Engine</span> Technology &bull; 2026 Hardsub-Killer
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 140, 196, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 140, 196, 0.4);
        }
      `}</style>
    </div>
  );
}
