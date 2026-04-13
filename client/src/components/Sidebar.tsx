import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, FileText, Database, Sparkles, Clock, Trash2 } from 'lucide-react';
import type { DocumentMetadata } from '../types';

interface SidebarProps {
  onNewChat: () => void;
  documentUpdateCounter: number;
  currentSessionId?: string;
  onSelectSession?: (id: string, title?: string) => void;
}

export function Sidebar({ onNewChat, documentUpdateCounter, currentSessionId, onSelectSession }: SidebarProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [sessions, setSessions] = useState<{id: string, title: string}[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchSessions();
  }, [documentUpdateCounter, currentSessionId]);

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      // Scope document list to the current session
      const url = currentSessionId
        ? `/api/documents?session_id=${encodeURIComponent(currentSessionId)}`
        : '/api/documents';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/chat/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (currentSessionId === id) {
        onNewChat();
      } else {
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  return (
    <div className="w-72 h-full flex flex-col bg-black/40 border-r border-white/5 backdrop-blur-3xl shrink-0 p-4 relative z-10 transition-transform">
      
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-2 mb-8 mt-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-glow flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-semibold tracking-tight text-white">DocChat</span>
      </div>

      {/* New Chat Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewChat}
        className="flex items-center justify-between w-full p-3 mb-6 glass-panel border border-white/10 hover:border-accent-cyan/50 hover:bg-surface-hover transition-colors group"
      >
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-5 h-5 text-gray-400 group-hover:text-accent-cyan transition-colors" />
          <span className="font-medium text-sm text-gray-200">New Chat</span>
        </div>
        <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center border border-white/10">
          <Plus className="w-4 h-4 text-gray-400" />
        </div>
      </motion.button>

      {/* Scrollable Container for Lists */}
      <div className="flex-1 overflow-y-auto scrollbar-hide -mx-2 px-2 flex flex-col space-y-6">
        
        {/* Recent Chats */}
        <div>
          <div className="flex items-center space-x-2 px-2 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Recent Chats</span>
          </div>
          
          <div className="space-y-1">
            {sessions.length === 0 ? (
              <div className="px-2 py-2 text-center text-xs text-gray-600">No recent chats</div>
            ) : (
              sessions.map((s) => (
                <div 
                  key={s.id}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all group cursor-pointer
                    ${currentSessionId === s.id 
                      ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan' 
                      : 'border-transparent hover:bg-surface-hover hover:border-white/5 text-gray-400 hover:text-gray-200'}`}
                  onClick={() => onSelectSession?.(s.id, s.title)}
                >
                  <div className="flex items-center overflow-hidden pr-2">
                    <MessageSquare className={`w-4 h-4 mr-3 shrink-0 ${currentSessionId === s.id ? 'text-accent-cyan' : 'text-gray-500 group-hover:text-gray-300'}`} />
                    <span className="text-sm font-medium truncate" title={s.title}>{s.title}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-md transition-all text-red-400"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Docs List */}
        <div>
          <div className="flex items-center space-x-2 px-2 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Database className="w-3.5 h-3.5" />
            <span>Knowledge Base</span>
          </div>

          {isLoadingDocs && documents.length === 0 ? (
            <div className="animate-pulse space-y-2 mt-4">
              {[1,2].map(i => (
                <div key={i} className="w-full h-12 bg-white/5 rounded-xl block"></div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-gray-600">
              No documents indexed yet.
            </div>
          ) : (
            <div className="space-y-1">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  className="flex flex-col p-3 rounded-xl bg-surface border border-transparent transition-all text-left cursor-default"
                >
                  <div className="flex items-center space-x-3 mb-1.5">
                    <FileText className="w-4 h-4 text-accent-violet shrink-0" />
                    <span className="text-sm font-medium text-gray-300 truncate">{doc.filename}</span>
                  </div>
                  <div className="flex items-center pl-7 space-x-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent-cyan/10 text-accent-cyan font-mono border border-accent-cyan/20">
                      {doc.chunk_count} chunks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
