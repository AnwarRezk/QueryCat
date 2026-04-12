import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (message: string) => void;
  onUploadSuccess: () => void;
  disabled: boolean;
}

export function ChatInput({ onSend, onUploadSuccess, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | null>(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('Only PDF files are supported.');
        return;
      }
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          onUploadSuccess();
          setUploadStatus('success');
          setTimeout(() => setUploadStatus(null), 2000);
        } else {
          alert('Upload failed');
        }
      } catch (err) {
        alert('An error occurred during upload.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="relative w-full max-w-4xl mx-auto xl:px-0">
      <form onSubmit={handleSubmit} className="relative flex items-end w-full glass-panel border focus-within:border-accent-cyan/50 transition-colors p-2 pb-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask a question about your documents..."
          className="w-full max-h-48 min-h-[44px] bg-transparent text-white placeholder-gray-500 rounded-xl resize-none py-3 pl-14 pr-14 focus:outline-none scrollbar-hide"
          rows={1}
        />
        
        {/* Attachment Pin Icon */}
        <div className="absolute left-3 bottom-3">
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileSelect} />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            title="Attach a PDF Document to Knowledge Base"
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all outline-none"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : uploadStatus === 'success' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Paperclip className="w-5 h-5" />}
          </button>
        </div>

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
          DocChat can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
