import { createContext, useContext } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

export interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
