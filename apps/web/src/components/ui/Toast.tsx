import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

type Tone = 'success' | 'error';

interface Toast {
  id: number;
  tone: Tone;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: Tone; action?: Toast['action'] }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback<ToastContextValue['notify']>(
    (message, options = {}) => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-2), { id, message, tone: options.tone ?? 'success', ...(options.action ? { action: options.action } : {}) }]);
      window.setTimeout(() => dismiss(id), options.action ? 8000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line-strong bg-elevated px-4 py-3 text-[14px] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.85)]"
            >
              {t.tone === 'success' ? (
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-mint" />
              ) : (
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-over" />
              )}
              <p className="flex-1 text-ink">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  className="font-medium text-mint hover:underline"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss" className="text-faint hover:text-ink" onClick={() => dismiss(t.id)}>
                <X aria-hidden className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
