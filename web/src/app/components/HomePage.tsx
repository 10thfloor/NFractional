"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function MandelbrotASCII({
  onConnect,
}: {
  onConnect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ASCII_CHARS = " .:-=+*#%@";

    let frame = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const fontSize = 12;
    ctx.font = `${fontSize}px monospace`;
    const charWidth = ctx.measureText("M").width;
    const charHeight = fontSize * 1.2;

    const cols = Math.floor(canvas.width / charWidth);
    const rows = Math.floor(canvas.height / charHeight);

    const mandelbrot = (x: number, y: number, maxIter: number): number => {
      let real = x;
      let imag = y;
      let n = 0;

      while (n < maxIter) {
        const real2 = real * real;
        const imag2 = imag * imag;

        if (real2 + imag2 > 4) break;

        const newReal = real2 - imag2 + x;
        imag = 2 * real * imag + y;
        real = newReal;
        n++;
      }

      return n;
    };

    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frame++;

      const zoomSpeed = 0.5;
      const startZoom = 700;
      const zoom = startZoom * 1.02 ** (frame * zoomSpeed ** 2);

      const centerX = -0.743643887037151;
      const centerY = 0.13182590420533;

      const maxIterations = Math.min(
        100 + Math.floor(Math.log2(zoom) * 20),
        2000
      );

      ctx.font = `${fontSize}px monospace`;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = centerX + (col - cols / 2) / (cols / 3) / zoom;
          const y = centerY + (row - rows / 2) / (rows / 3) / zoom;

          const iterations = mandelbrot(x, y, maxIterations);

          let charIndex: number;
          if (iterations === maxIterations) {
            charIndex = 0;
          } else {
            charIndex = Math.floor(
              (iterations / maxIterations) * (ASCII_CHARS.length - 1)
            );
          }

          const char = ASCII_CHARS[charIndex];

          const hue = (iterations / maxIterations) * 360 + frame * 0.5;
          const saturation = iterations === maxIterations ? 0 : 75;
          const lightness =
            iterations === maxIterations
              ? 0
              : 30 + (iterations / maxIterations) * 30;

          ctx.shadowBlur = 8;
          ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
          ctx.fillText(char, col * charWidth, row * charHeight);

          ctx.shadowBlur = 0;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div
        className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
        }}
      />

      {/* Connect Wallet Button Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        {/* Subtle dark overlay for better text contrast */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/20 to-black/60 pointer-events-none" />

        <div className="text-center space-y-6 z-10 max-w-xl px-4 relative">
          {/* Frosted glass backdrop for text */}
          <div className="absolute inset-0 -inset-x-6 -inset-y-8 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl pointer-events-none" />

          <div className="relative space-y-4 py-6">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-1 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] tracking-tight">
                NFractional
              </h1>
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/50 to-transparent mx-auto shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            </div>
            <p className="text-white/95 text-lg md:text-xl mb-2 drop-shadow-[0_0_15px_rgba(0,0,0,0.9)] font-medium tracking-wide">
              NFT Fractionalization on Flow
            </p>
            <p className="text-neutral-300/80 text-sm md:text-base mb-6 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] font-light max-w-md mx-auto leading-relaxed">
              <span className="text-neutral-200/90 font-normal">
                Make singular NFTs
              </span>{" "}
              into <span className="text-white/90 font-medium">infinite</span>{" "}
              tradable fractions
            </p>
            <Button
              onClick={onConnect}
              size="lg"
              className="relative bg-gradient-to-r from-neutral-800/90 via-neutral-700/90 to-neutral-800/90 text-white hover:from-neutral-700 hover:via-neutral-600 hover:to-neutral-700 border border-white/30 hover:border-white/50 text-base px-8 py-5 font-medium shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,0,0,0.9)]"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
