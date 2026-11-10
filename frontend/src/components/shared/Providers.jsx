'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ToastProvider } from '../../asaas-ui';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function Providers({ children }) {
  useEffect(() => {
    // Offline evidence is handled explicitly by the Android client.
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--glass-tint-strong)',
              color: 'var(--text)',
              border: '1px solid var(--glass-rim-low)',
              borderRadius: 'var(--radius-pill)',
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
              iconTheme: { primary: 'var(--unpaid)', secondary: 'var(--on-accent)' },
            },
            duration: 4000,
          }}
        />
      </ToastProvider>
    </QueryClientProvider>
  );
}
