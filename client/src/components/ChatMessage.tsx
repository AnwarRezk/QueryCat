import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { User, Bot, FileText } from 'lucide-react';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 
          ${isUser ? 'bg-gradient-glow ml-3' : 'glass-panel border-white/10 mr-3'}`}
        >
          {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-accent-cyan" />}
        </div>
        
        {/* Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`py-3 px-4 ${isUser 
              ? 'bg-surface border border-white/5 rounded-2xl rounded-tr-sm text-white' 
              : 'glass-panel rounded-2xl rounded-tl-sm prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/30'}`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </div>
          
          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 font-medium tracking-wide uppercase mt-1 mr-1">Sources:</span>
              {message.sources.map((src, i) => (
                <div key={i} className="flex items-center space-x-1 glass-panel px-2 py-1 rounded-md border-white/5 bg-surface-hover group cursor-help relative hover:z-10">
                  <FileText className="w-3 h-3 text-accent-cyan" />
                  <span className="text-xs text-gray-300 truncate max-wxs">{src.source} (p. {src.page})</span>
                  
                  {/* Tooltip */}
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-0 mb-2 w-64 p-3 glass-panel rounded-lg shadow-2xl pointer-events-none transform translate-y-2 group-hover:translate-y-0">
                    <p className="text-xs text-gray-300 line-clamp-4 leading-relaxed">{src.content_preview}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </motion.div>
  );
}
