import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Search } from 'lucide-react';

interface WelcomeScreenProps {
  onExampleClick: (text: string) => void;
}

export function WelcomeScreen({ onExampleClick }: WelcomeScreenProps) {
  const examples = [
    "What are the main topics discussed?",
    "Summarize the key findings.",
    "Are there any action items listed?",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-8 relative"
      >
        <div className="absolute inset-0 bg-gradient-glow blur-2xl opacity-20 hover:opacity-40 transition-opacity duration-1000 rounded-full" />
        <div className="glass-panel p-6 rounded-3xl relative flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-accent-cyan" />
        </div>
      </motion.div>
      
      <motion.h1 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="text-4xl font-semibold mb-4 text-gradient"
      >
        Welcome to DocChat
      </motion.h1>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="text-gray-400 mb-12 text-lg"
      >
        Upload your PDF documents and start asking questions. Everything runs privately and securely.
      </motion.p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {examples.map((ex, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + (i * 0.1) }}
            onClick={() => onExampleClick(ex)}
            className="glass-panel p-4 text-left hover:bg-surface-hover transition-colors group cursor-pointer border border-white/5"
          >
            <p className="text-sm text-gray-300 group-hover:text-white transition-colors">"{ex}"</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
