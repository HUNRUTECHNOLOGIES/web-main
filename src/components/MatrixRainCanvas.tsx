import { useEffect, useRef } from 'react';
import type { AppTheme } from './SettingsModal.tsx';

interface MatrixRainCanvasProps {
  enabled: boolean;
  theme: AppTheme;
}

const GLYPHS =
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFZ<>/*+-=#$%';

export function MatrixRainCanvas({ enabled, theme }: MatrixRainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isMatrix = theme === 'matrix';
    const fontSize = 15;
    const columnStep = 18;
    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    let rafId: number | null = null;
    let lastTick = 0;

    const initGrid = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      columns = Math.max(1, Math.ceil(width / columnStep));
      const rowsMax = Math.ceil(height / fontSize);
      drops = Array.from({ length: columns }, () =>
        Math.floor(Math.random() * rowsMax)
      );
      speeds = Array.from({ length: columns }, () => 0.65 + Math.random() * 0.75);

      ctx.fillStyle = isMatrix ? '#000000' : '#0A0D12';
      ctx.fillRect(0, 0, width, height);
    };

    const drawFrame = () => {
      // Translucent trail fade so falling columns dissolve smoothly
      ctx.fillStyle = isMatrix ? 'rgba(0, 0, 0, 0.07)' : 'rgba(10, 13, 18, 0.1)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`;
      ctx.textBaseline = 'top';

      for (let i = 0; i < columns; i++) {
        const x = i * columnStep;
        const y = Math.floor(drops[i]) * fontSize;
        const char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

        // Bright phosphor head glyph with Matrix glow
        const isHeadBright = Math.random() > 0.25;
        if (isMatrix) {
          ctx.shadowColor = '#39FF14';
          ctx.shadowBlur = isHeadBright ? 8 : 3;
          ctx.fillStyle = isHeadBright ? '#D9FFD4' : '#39FF14';
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = isHeadBright ? '#00FF66' : '#00E5FF';
        }
        ctx.fillText(char, x, y);

        // Trailing phosphor character one row above
        ctx.shadowBlur = 0;
        if (drops[i] >= 1) {
          const trailChar = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ctx.fillStyle = isMatrix ? 'rgba(0, 255, 102, 0.65)' : 'rgba(0, 255, 102, 0.36)';
          ctx.fillText(trailChar, x, (Math.floor(drops[i]) - 1) * fontSize);
        }

        if (y > height && Math.random() > 0.972) {
          drops[i] = 0;
        } else {
          drops[i] += speeds[i];
        }
      }
    };

    initGrid();

    if (prefersReducedMotion) {
      // Render a calm static glyph field once without continuous animation
      for (let step = 0; step < 18; step++) {
        drawFrame();
      }
      const onResize = () => {
        initGrid();
        for (let step = 0; step < 18; step++) drawFrame();
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const animate = (timestamp: number) => {
      if (timestamp - lastTick >= 46) {
        lastTick = timestamp;
        drawFrame();
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    window.addEventListener('resize', initGrid);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', initGrid);
    };
  }, [enabled, theme]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-300 ${
        theme === 'matrix' ? 'opacity-60' : 'opacity-28'
      }`}
    />
  );
}
