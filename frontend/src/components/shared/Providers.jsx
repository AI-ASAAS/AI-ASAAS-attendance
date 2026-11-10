'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function Providers({ children }) {
  // Register Service Worker for PWA
  useEffect(() => {
    // The upstream worker persisted credentials and replayed unverified attendance.
    // ASAS offline evidence is handled explicitly by the Android client instead.
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--glass-tint-strong)',
            color: 'var(--text)',
            border: '1px solid var(--glass-rim-low)',
            borderRadius: '999px',
            boxShadow: 'var(--glass-shadow)',
            backdropFilter: 'blur(24px) saturate(175%)',
            WebkitBackdropFilter: 'blur(24px) saturate(175%)',
            fontFamily: 'var(--font)',
            fontSize: '14px',
            padding: '10px 18px',
          },
          success: {
            iconTheme: { primary: 'var(--paid)', secondary: 'var(--on-accent)' },
          },
          error: {
            iconTheme: { primary: 'var(--unpaid)', secondary: '#ffffff' },
          },
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
