import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { ToastContext, type Toast } from './toast-context';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timeouts = toastTimeoutsRef.current;

    return () => {
      for (const timeoutId of timeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      timeouts.clear();
    };
  }, []);

  const toast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-dismiss after 5s
    const timeoutId = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 5000);

    toastTimeoutsRef.current.set(id, timeoutId);
  }, []);

  const dismiss = useCallback((id: string) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }

    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const error = useCallback((message: string) => toast(message, 'error'), [toast]);
  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const info = useCallback((message: string) => toast(message, 'info'), [toast]);

  const ICONS = {
    error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
    success: <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-accent-cyan shrink-0" />,
  };

  const BORDER = {
    error: 'border-red-500/30 bg-red-500/10',
    success: 'border-green-500/30 bg-green-500/10',
    info: 'border-accent-cyan/30 bg-accent-cyan/10',
  };

  return (
    <ToastContext.Provider value={{ toast, error, success, info, dismiss }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-[max(env(safe-area-inset-top),0.5rem)] left-[var(--chat-pane-left-offset)] right-0 z-[70] flex justify-center px-3 sm:px-4 pointer-events-none">
        <div className="flex w-full max-w-md flex-col gap-2">
          <AnimatePresence>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl border backdrop-blur-xl shadow-2xl ${BORDER[t.type]}`}
              >
                {ICONS[t.type]}
                <p className="text-sm text-gray-200 flex-1 leading-snug">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
}
