import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-dismiss after 5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
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

      {/* Toast Container — fixed top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl border backdrop-blur-xl shadow-2xl ${BORDER[t.type]}`}
            >
              {ICONS[t.type]}
              <p className="text-sm text-gray-200 flex-1 leading-snug">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
