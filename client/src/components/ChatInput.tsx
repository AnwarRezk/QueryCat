import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Loader2, CheckCircle, X, FileText, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../hooks/useToast';

interface ChatInputProps {
  onSend: (message: string) => void;
  onUploadSuccess: () => void;
  sessionId: string;
  disabled: boolean;
}

interface PendingFile {
  id: string;        // local UI id
  file: File;
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  documentId?: string; // server-assigned document id (set on success)
  error?: string;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-3 h-3" />,
  docx: <File className="w-3 h-3" />,
  md: <File className="w-3 h-3" />,
};

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? <File className="w-3 h-3" />;
}

export function ChatInput({ onSend, onUploadSuccess, sessionId, disabled }: ChatInputProps) {
  const { error: showError } = useToast();
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const uploadFile = async (pending: PendingFile) => {
    setPendingFiles(prev =>
      prev.map(p => p.id === pending.id ? { ...p, status: 'uploading' } : p)
    );

    const formData = new FormData();
    formData.append('files', pending.file);
    formData.append('session_id', sessionId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok && data.successful > 0) {
        const documentId = data.results?.[0]?.document_id;
        setPendingFiles(prev =>
          prev.map(p => p.id === pending.id ? { ...p, status: 'success', documentId } : p)
        );
        onUploadSuccess();
        
        // Auto clear after 10 seconds
        setTimeout(() => {
          setPendingFiles(prev => prev.filter(p => p.id !== pending.id));
        }, 10000);
      } else {
        const result = data.results?.[0];
        setPendingFiles(prev =>
          prev.map(p =>
            p.id === pending.id
              ? { ...p, status: 'error', error: result?.error ?? 'Upload failed' }
              : p
          )
        );
      }
    } catch {
      showError(`Failed to upload ${pending.name}`);
      setPendingFiles(prev =>
        prev.map(p =>
          p.id === pending.id ? { ...p, status: 'error', error: 'Network error' } : p
        )
      );
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const newFiles: PendingFile[] = Array.from(e.target.files).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      status: 'pending' as const,
    }));

    // Add to pending list immediately
    setPendingFiles(prev => [...prev, ...newFiles]);

    // Upload all files in parallel
    await Promise.all(newFiles.map(uploadFile));

    // Reset file input so same file can be reselected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = async (pending: PendingFile) => {
    // If already uploaded to server, delete it from the knowledge base
    if (pending.status === 'success' && pending.documentId) {
      try {
        await fetch(`/api/documents/${pending.documentId}`, { method: 'DELETE' });
        onUploadSuccess(); // Refresh sidebar doc list
      } catch {
        showError("Failed to delete document from server");
      }
    }
    setPendingFiles(prev => prev.filter(p => p.id !== pending.id));
  };

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="relative w-full max-w-4xl mx-auto xl:px-0">
      {/* File Pills Area */}
      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 mb-2 px-1"
          >
            {pendingFiles.map(pf => (
              <motion.div
                key={pf.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`group/pill flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs font-medium border transition-colors relative
                  ${pf.status === 'success'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : pf.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : pf.status === 'uploading'
                        ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan'
                        : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                title={pf.status === 'error' ? pf.error : pf.name}
              >
                {pf.status === 'uploading'
                  ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  : pf.status === 'success'
                    ? <CheckCircle className="w-3 h-3 shrink-0" />
                    : getFileIcon(pf.name)
                }
                <span className="max-w-[120px] truncate">{pf.name}</span>
                {pf.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => removeFile(pf)}
                    title={pf.status === 'success' ? 'Delete this document' : 'Dismiss'}
                    className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end w-full glass-panel border focus-within:border-accent-cyan/50 transition-colors p-2"
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask a question, or attach a document with the 📎 icon..."
          className="w-full max-h-48 min-h-[44px] bg-transparent text-white placeholder-gray-500 rounded-xl resize-none py-3 pl-14 pr-14 focus:outline-none scrollbar-hide"
          rows={1}
        />

        {/* Paperclip attachment button */}
        <div className="absolute left-3 bottom-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.md"
            multiple
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach PDF, Word (.docx), or Markdown (.md) files to this conversation"
            className="p-2 text-gray-400 hover:text-accent-cyan rounded-xl hover:bg-white/5 transition-all outline-none group relative"
          >
            <Paperclip className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-black/80 text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
              Attach PDF, DOCX, or MD
            </span>
          </button>
        </div>

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          disabled={!text.trim() || disabled}
          className="absolute right-3 bottom-3 p-2 rounded-xl bg-gradient-glow text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-cyan/20 flex-shrink-0"
        >
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      </form>

      <div className="text-center mt-2">
        <p className="text-[11px] text-gray-500 font-medium">
          Query Cat can make mistakes. Attach PDF, DOCX, or MD files to ground answers in your documents.
        </p>
      </div>
    </div>
  );
}
