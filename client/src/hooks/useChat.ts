import { useState, useCallback } from 'react';
import type { Message } from '../types';
import { useToast } from './toast-context';

export function useChat() {
  const { error: showError } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (messageText: string, sessionId: string) => {
    const requestMsg: Message = { role: 'user', content: messageText, id: Date.now().toString() };
    setMessages((prev) => [...prev, requestMsg]);
    setIsLoading(true);
    setError(null);

    const responseId = (Date.now() + 1).toString();
    let pendingSources: Message['sources'] = [];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, session_id: sessionId })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let sseBuffer = '';

      const processSseLine = (rawLine: string): boolean => {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) return false;

        const dataStr = line.slice(5).trim();
        if (!dataStr) return false;

        if (dataStr === '[DONE]') {
          return true;
        }

        try {
          const dataObj = JSON.parse(dataStr);
          if (dataObj.type === 'token') {
            const token = typeof dataObj.content === 'string' ? dataObj.content : '';
            if (!token) return false;

            setMessages((prev) =>
              prev.some((msg) => msg.id === responseId)
                ? prev.map((msg) =>
                    msg.id === responseId
                      ? { ...msg, content: msg.content + token }
                      : msg
                  )
                : [...prev, { role: 'ai', content: token, id: responseId, sources: pendingSources }]
            );
          } else if (dataObj.type === 'sources') {
            const documents = Array.isArray(dataObj.documents) ? dataObj.documents : [];
            pendingSources = documents;

            setMessages((prev) =>
              prev.some((msg) => msg.id === responseId)
                ? prev.map((msg) =>
                    msg.id === responseId
                      ? { ...msg, sources: documents }
                      : msg
                  )
                : prev
            );
          } else if (dataObj.type === 'error') {
            const streamErr =
              typeof dataObj.content === 'string' && dataObj.content.trim()
                ? dataObj.content
                : 'An error occurred while chatting.';
            showError(streamErr);
            setError(streamErr);
          }
        } catch {
          // Silently skip malformed SSE lines
        }

        return false;
      };

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (processSseLine(line)) {
              done = true;
              break;
            }
          }
        }
      }

      // Flush any trailing decoder bytes and a final buffered line when stream closes.
      sseBuffer += decoder.decode();
      if (sseBuffer.trim()) {
        const trailingLines = sseBuffer.split('\n');
        for (const line of trailingLines) {
          if (processSseLine(line)) {
            break;
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while chatting.';
      showError(msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const fetchSession = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      showError("Failed to load chat history");
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  return { messages, sendMessage, isLoading, error, clearMessages, fetchSession };
}
