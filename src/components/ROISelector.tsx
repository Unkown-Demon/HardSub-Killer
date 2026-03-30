import React, { useState, useRef, useEffect } from 'react';

interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ROISelectorProps {
  onSelect: (roi: ROI) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const ROISelector: React.FC<ROISelectorProps> = ({ onSelect, videoRef }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentROI, setCurrentROI] = useState<ROI | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentROI({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const w = x - startPos.x;
    const h = y - startPos.y;

    setCurrentROI({
      x: w > 0 ? startPos.x : x,
      y: h > 0 ? startPos.y : y,
      w: Math.abs(w),
      h: Math.abs(h),
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    if (currentROI && currentROI.w > 5 && currentROI.h > 5) {
      // Scale ROI to video dimensions
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const scaleX = video.videoWidth / canvas.width;
        const scaleY = video.videoHeight / canvas.height;
        onSelect({
          x: Math.round(currentROI.x * scaleX),
          y: Math.round(currentROI.y * scaleY),
          w: Math.round(currentROI.w * scaleX),
          h: Math.round(currentROI.h * scaleY),
        });
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Match canvas size to video display size
    const updateSize = () => {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentROI) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentROI.x, currentROI.y, currentROI.w, currentROI.h);
      ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
      ctx.fillRect(currentROI.x, currentROI.y, currentROI.w, currentROI.h);
      
      // Draw corner handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(currentROI.x - 4, currentROI.y - 4, 8, 8);
      ctx.fillRect(currentROI.x + currentROI.w - 4, currentROI.y - 4, 8, 8);
      ctx.fillRect(currentROI.x - 4, currentROI.y + currentROI.h - 4, 8, 8);
      ctx.fillRect(currentROI.x + currentROI.w - 4, currentROI.y + currentROI.h - 4, 8, 8);
    }
  }, [currentROI]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
};
