import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Glass } from './Glass';
import { Icon } from './Icon';

type Tone = 'success' | 'error';
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, tone, message }]);
    setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), 3600);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {items.map((t) => (
            <Glass key={t.id} thick pill className={`toast toast--${t.tone}`}>
              <Icon name={t.tone === 'success' ? 'checkCircle' : 'alert'} />
              {t.message}
            </Glass>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
