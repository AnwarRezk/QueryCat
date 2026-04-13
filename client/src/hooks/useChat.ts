import { useState, useCallback } from 'react';
import type { Message } from '../types';
import { useToast } from './useToast';

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
    setMessages((prev) => [
      ...prev,
      { role: 'ai', content: '', id: responseId, sources: [] }
    ]);

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

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              if (dataStr) {
                try {
                  const dataObj = JSON.parse(dataStr);
                  if (dataObj.type === 'token') {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === responseId
                          ? { ...msg, content: msg.content + dataObj.content }
                          : msg
                      )
                    );
                  } else if (dataObj.type === 'sources') {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === responseId
                          ? { ...msg, sources: dataObj.documents }
                          : msg
                      )
                    );
                  } else if (dataObj.type === 'error') {
                    setError(dataObj.content);
                  }
                } catch {
                  // Silently skip malformed SSE lines
                }
              }
            }
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
