'use client';

import { useEffect, useRef } from 'react';

/**
 * Osciloscopio decorativo desacoplado del highlighting y del transporte.
 * Vive en un RAF propio para no mezclar concerns visuales con la edición del código.
 */
export function Oscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let rafId = 0;
    let frame = 0;
    const draw = () => {
      frame += 1;
      const width = canvas.clientWidth;
      const height = canvas.height;
      if (canvas.width !== width) canvas.width = width;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(0,255,200,0.5)';
      context.lineWidth = 1.5;
      context.beginPath();
      for (let x = 0; x < width; x += 1) {
        const angle = (x + frame * 2) * 0.03;
        const y = height / 2 + Math.sin(angle) * 10;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <canvas ref={canvasRef} className="scope-canvas w-full" height={50} />;
}
