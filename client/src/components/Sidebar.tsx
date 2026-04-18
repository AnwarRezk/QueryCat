import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, FileText, Database, Cat, Clock, Trash2, X } from 'lucide-react';
import type { DocumentMetadata } from '../types';
import { useToast } from '../hooks/toast-context';

interface SidebarProps {
  onNewChat: () => void;
  documentUpdateCounter: number;
  sessionUpdateCounter: number;
  currentSessionId?: string;
  onSelectSession?: (id: string, title?: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

const DEV_EFFECT_DEDUPE_WINDOW_MS = 1200;
const recentDocsEffectRuns = new Map<string, number>();
const recentSessionsEffectRuns = new Map<string, number>();

// In React StrictMode (dev-only), mount effects intentionally run twice.
const shouldSkipDevDuplicate = (cache: Map<string, number>, key: string): boolean => {
  if (!import.meta.env.DEV) {
    return false;
  }

  const now = Date.now();
  const previous = cache.get(key);
  cache.set(key, now);

  return previous !== undefined && now - previous < DEV_EFFECT_DEDUPE_WINDOW_MS;
};

export function Sidebar({ onNewChat, documentUpdateCounter, sessionUpdateCounter, currentSessionId, onSelectSession, isMobile, onClose }: SidebarProps) {
  const { error: showError } = useToast();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [sessions, setSessions] = useState<{ id: string, title: string }[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
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
    } catch {
      showError("Failed to load documents");
    } finally {
      setIsLoadingDocs(false);
    }
  }, [currentSessionId, showError]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      showError("Failed to load recent chats");
    }
  }, [showError]);

  useEffect(() => {
    const docsEffectKey = `${currentSessionId ?? 'all'}:${documentUpdateCounter}`;
    if (shouldSkipDevDuplicate(recentDocsEffectRuns, docsEffectKey)) {
      return;
    }

    fetchDocuments();
  }, [documentUpdateCounter, currentSessionId, fetchDocuments]);

  useEffect(() => {
    const sessionsEffectKey = `${currentSessionId ?? 'all'}:${sessionUpdateCounter}`;
    if (shouldSkipDevDuplicate(recentSessionsEffectRuns, sessionsEffectKey)) {
      return;
    }

    fetchSessions();
  }, [sessionUpdateCounter, currentSessionId, fetchSessions]);

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (currentSessionId === id) {
        onNewChat();
      } else {
        fetchSessions();
      }
    } catch {
      showError("Failed to delete chat session");
    }
  };

  const handleDeleteDocument = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    setDeletingDocId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        showError("Failed to delete document");
      }
    } catch {
      showError("Failed to delete document");
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64 lg:w-72'} h-full flex flex-col bg-black/40 border-r border-white/5 backdrop-blur-3xl shrink-0 p-3 sm:p-4 relative z-10 transition-transform`}>
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2 mb-5 md:mb-6 lg:mb-8 mt-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-glow flex items-center justify-center">
            <Cat className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-regular tracking-tight text-white" style={{ fontFamily: '"Bitcount Grid Double", monospace' }}>Query Cat</span>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewChat}
        className="flex items-center justify-between w-full p-3 mb-4 md:mb-6 glass-panel border border-white/10 hover:border-accent-cyan/50 hover:bg-surface-hover transition-colors group"
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
                    className="p-1.5 md:opacity-0 md:group-hover:opacity-100 hover:bg-white/10 rounded-md transition-all text-red-400"
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
              {[1, 2].map(i => (
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
                  className="flex items-center justify-between p-3 rounded-xl bg-surface border border-transparent transition-all text-left group/doc hover:border-white/10"
                >
                  <div className="flex flex-col overflow-hidden pr-2">
                    <div className="flex items-center space-x-3 mb-1">
                      <FileText className="w-4 h-4 text-accent-violet shrink-0" />
                      <span className="text-sm font-medium text-gray-300 truncate">{doc.filename}</span>
                    </div>
                    <div className="flex items-center pl-7 space-x-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent-cyan/10 text-accent-cyan font-mono border border-accent-cyan/20">
                        {doc.chunk_count} chunks
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDocument(e, doc.id)}
                    disabled={deletingDocId === doc.id}
                    className="p-1.5 md:opacity-0 md:group-hover/doc:opacity-100 hover:bg-white/10 rounded-md transition-all text-red-400 shrink-0 disabled:opacity-50"
                    title="Delete document from knowledge base"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="mt-4 pt-3 border-t border-white/5 text-center">
        <p className="text-[11px] text-gray-500 tracking-wide">Built by Anwar</p>
      </div>
    </div>
  );
}
