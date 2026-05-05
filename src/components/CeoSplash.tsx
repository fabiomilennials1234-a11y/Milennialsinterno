import { useState, useEffect, useCallback } from 'react';
import ceoSplashImage from '@/assets/ceo-splash.jpeg';

const SPLASH_DURATION = 10;
const SESSION_KEY = 'ceo-splash-shown';

export default function CeoSplash() {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(SPLASH_DURATION);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(true);
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
    const timeout = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(timeout);
  }, [fading]);

  // Block keyboard escape
  const blockKeys = useCallback((e: KeyboardEvent) => {
    if (visible && !fading) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [visible, fading]);

  useEffect(() => {
    if (!visible) return;
    document.addEventListener('keydown', blockKeys, true);
    return () => document.removeEventListener('keydown', blockKeys, true);
  }, [visible, blockKeys]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
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
      <img
        src={ceoSplashImage}
        alt=""
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
          objectFit: 'contain',
          borderRadius: '8px',
        }}
        draggable={false}
      />

      {/* Countdown timer */}
      <div
        style={{
          marginTop: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: '3rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {countdown}
        </span>

        {/* Progress bar */}
        <div
          style={{
            width: '200px',
            height: '4px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: '#fff',
              borderRadius: '2px',
              width: `${(countdown / SPLASH_DURATION) * 100}%`,
              transition: 'width 1s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
