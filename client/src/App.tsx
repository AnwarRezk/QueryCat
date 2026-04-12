import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TypingIndicator } from './components/TypingIndicator';
import { useChat } from './hooks/useChat';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [docUpdateCounter, setDocUpdateCounter] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, sendMessage, isLoading, error, clearMessages, fetchSession } = useChat();

  const handleNewChat = () => {
    setSessionId(Date.now().toString());
    clearMessages();
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    fetchSession(id);
  };

  const handleUploadSuccess = () => {
    setDocUpdateCounter(c => c + 1);
  };

  const handleSend = async (text: string) => {
    await sendMessage(text, sessionId);
    // Force sidebar to refresh sessions
    setDocUpdateCounter(c => c + 1);
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden relative selection:bg-accent-cyan/30">
      <Sidebar 
        onNewChat={handleNewChat} 
        documentUpdateCounter={docUpdateCounter} 
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
      />
      
      <main className="flex-1 flex flex-col relative z-10 w-full md:max-w-[calc(100vw-18rem)]">
        
        {/* Header Bar */}
        <header className="h-16 border-b border-white/5 flex items-center px-6 shrink-0 bg-black/20 backdrop-blur-md justify-between">
          <h2 className="text-sm font-medium text-gray-300">Session: <span className="font-mono text-xs ml-1 text-gray-500">{sessionId}</span></h2>
        </header>

        {/* Scrollable Content */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide flex flex-col relative"
        >
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col pt-12 pb-32">
               <WelcomeScreen onExampleClick={handleSend} />
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto px-4 py-8 pb-32 flex flex-col min-h-full justify-end">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <TypingIndicator />
                  </motion.div>
                )}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mx-auto my-4 max-w-xl text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Fixed Input Area always visible */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pb-6 pt-12 px-4 z-20 pointer-events-none flex flex-col items-center justify-end">
          <div className="pointer-events-auto w-full max-w-4xl mx-auto flex flex-col">
            <div className="w-full mt-2">
              <ChatInput onSend={handleSend} onUploadSuccess={handleUploadSuccess} disabled={isLoading} />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
