import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { User, Cat, FileText, Plus } from 'lucide-react';
import type { Message } from '../types';
import { Modal } from './Modal';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isUser = message.role === 'user';
  
  const displayedSources = message.sources?.slice(0, 3) || [];
  const extraSourcesCount = (message.sources?.length || 0) - 3;

  return (
    <>
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
            {isUser ? <User className="w-5 h-5 text-white" /> : <Cat className="w-5 h-5 text-accent-cyan" />}
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
              <div className="mt-3 flex flex-wrap gap-2 text-left">
                <span className="text-xs text-gray-500 font-medium tracking-wide uppercase mt-1 mr-1">Sources:</span>
                {displayedSources.map((src, i) => (
                  <div key={i} className="flex items-center space-x-1 glass-panel px-2 py-1 rounded-md border-white/5 bg-surface-hover">
                    <FileText className="w-3 h-3 text-accent-cyan shrink-0" />
                    <span className="text-xs text-gray-300 truncate max-w-[200px]">{src.source} (p. {src.page})</span>
                  </div>
                ))}

                {/* Show More Button */}
                {extraSourcesCount > 0 && (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-1 glass-panel px-2 py-1 rounded-md border-white/10 hover:border-accent-cyan/50 bg-black/20 hover:bg-accent-cyan/10 transition-all text-xs text-accent-cyan font-medium group"
                  >
                    <Plus className="w-3 h-3 transition-transform group-hover:rotate-90" />
                    <span>{extraSourcesCount} more</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
        </div>
      </motion.div>

      {/* Sources Modal abstracted */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <>
            <FileText className="w-5 h-5 text-accent-cyan" /> 
            Reference Sources
          </>
        }
      >
        {message.sources?.map((src, i) => (
          <div key={i} className="flex flex-col gap-2 p-5 rounded-xl bg-black/20 border border-white/5">
            <div className="flex items-start gap-3">
               <FileText className="w-5 h-5 text-accent-cyan mt-0.5 shrink-0" />
               <div className="flex flex-col gap-1.5 flex-1">
                  <span className="text-base font-medium text-gray-200">
                     {src.source} <span className="text-gray-500 font-normal ml-1">· Page {src.page}</span>
                  </span>
                  <p className="text-sm text-gray-400 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                     {src.content_preview}
                  </p>
               </div>
            </div>
          </div>
        ))}
      </Modal>
    </>
  );
}
