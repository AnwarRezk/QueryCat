import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setStatus('error');
      setMessage('Only PDF files are supported.');
      return;
    }

    setStatus('uploading');
    setMessage('Processing document...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Upload successful!');
        onUploadSuccess();
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 3000);
      } else {
        throw new Error(data.detail || 'Upload failed');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'An error occurred during upload.');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-2">
      <div
        className={`relative w-full rounded-xl border border-dashed transition-all duration-300 ease-out overflow-hidden group cursor-pointer
          ${isDragging 
            ? 'border-accent-cyan bg-accent-cyan/10' 
            : 'border-white/20 bg-black/40 backdrop-blur-md hover:bg-surface hover:border-white/30'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf" 
          onChange={handleFileSelect} 
        />
        
        <div className="flex flex-col items-center justify-center py-2.5 px-4 text-center">
          <AnimatePresence mode="popLayout">
            {status === 'idle' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex flex-row items-center space-x-2"
              >
                <UploadCloud className={`w-4 h-4 transition-colors ${isDragging ? 'text-accent-cyan' : 'text-gray-400 group-hover:text-white'}`} />
                <p className="text-xs font-medium text-gray-400 group-hover:text-gray-300">
                  Select a PDF or drag and drop here
                </p>
              </motion.div>
            )}
            
            {status === 'uploading' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex flex-row items-center space-x-2 text-accent-cyan"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-xs font-medium">{message}</p>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex flex-row items-center space-x-2 text-green-400"
              >
                <CheckCircle className="w-4 h-4" />
                <p className="text-xs font-medium">{message}</p>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex flex-row items-center space-x-2 text-red-400"
              >
                <AlertCircle className="w-4 h-4" />
                <p className="text-xs font-medium">{message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
