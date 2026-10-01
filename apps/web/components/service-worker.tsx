'use client';

import { useEffect } from 'react';

/** רישום ה-service worker (מסך "אין חיבור" בלבד — ראה public/sw.js). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
