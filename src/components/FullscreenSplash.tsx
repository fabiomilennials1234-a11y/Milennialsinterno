import { useState, useEffect, useCallback } from 'react';

const SPLASH_DURATION = 30;

interface FullscreenSplashProps {
  imageSrc: string;
}

export default function FullscreenSplash({ imageSrc }: FullscreenSplashProps) {
  const [visible, setVisible] = useState(true);
  const [countdown, setCountdown] = useState(SPLASH_DURATION);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFading(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    if (!fading) return;
    const timeout = setTimeout(() => {
      setVisible(false);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }, 600);
    return () => clearTimeout(timeout);
  }, [fading]);

  const blockKeys = useCallback((e: KeyboardEvent) => {
    if (visible && !fading) {
      e.preventDefault();
      e.stopPropagation();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    }
  }, [visible, fading]);

  useEffect(() => {
    if (!visible) return;
    document.addEventListener('keydown', blockKeys, true);
    return () => document.removeEventListener('keydown', blockKeys, true);
  }, [visible, blockKeys]);

  if (!visible) return null;

  const progress = countdown / SPLASH_DURATION;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        backgroundColor: '#000',
        opacity: fading ? 0 : 1,
        transition: 'opacity 600ms ease-out',
        pointerEvents: 'all',
        cursor: 'default',
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Fullscreen background image */}
      <img
        src={imageSrc}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
        draggable={false}
      />

      {/* Bottom overlay for timer visibility */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          paddingBottom: '3rem',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: '4rem',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.03em',
            textShadow: '0 2px 20px rgba(0,0,0,0.8)',
          }}
        >
          {countdown}
        </span>

        {/* Rainbow progress bar */}
        <div
          style={{
            width: '280px',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: '3px',
              width: `${progress * 100}%`,
              transition: 'width 1s linear',
              background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff00ff)',
              backgroundSize: '280px 6px',
            }}
          />
        </div>
      </div>
    </div>
  );
}
