import { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TypingIndicator } from './components/TypingIndicator';
import { useChat } from './hooks/useChat';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';

function App() {
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [docUpdateCounter, setDocUpdateCounter] = useState(0);
  const [sessionUpdateCounter, setSessionUpdateCounter] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, sendMessage, isLoading, error, clearMessages, fetchSession } = useChat();

  const handleNewChat = () => {
    setSessionId(crypto.randomUUID());
    clearMessages();
    setSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    fetchSession(id);
    setSidebarOpen(false);
  };

  const handleUploadSuccess = () => {
    setDocUpdateCounter(c => c + 1);
  };

  const handleSend = async (text: string) => {
    await sendMessage(text, sessionId);
    setSessionUpdateCounter(c => c + 1);
  };

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const shortId = sessionId.slice(0, 8);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background relative selection:bg-accent-cyan/30 md:h-screen md:min-h-0 md:overflow-hidden">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-40 w-[18rem] max-w-[85vw] md:hidden"
          >
            <Sidebar 
              onNewChat={handleNewChat} 
              documentUpdateCounter={docUpdateCounter} 
              sessionUpdateCounter={sessionUpdateCounter}
              currentSessionId={sessionId}
              onSelectSession={handleSelectSession}
              isMobile
              onClose={closeSidebar}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop persistent sidebar */}
      <div className="hidden md:flex">
        <Sidebar 
          onNewChat={handleNewChat} 
          documentUpdateCounter={docUpdateCounter} 
          sessionUpdateCounter={sessionUpdateCounter}
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
        />
      </div>
      
      <main className="flex-1 min-w-0 flex flex-col relative z-10">
        {/* Header Bar */}
        <header className="h-14 md:h-16 border-b border-white/5 flex items-center px-3 sm:px-4 md:px-5 lg:px-6 shrink-0 bg-black/20 backdrop-blur-md justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium text-gray-300 truncate">
              Session: <span className="font-mono text-xs ml-0.5 text-gray-500">{shortId}</span>
            </h2>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 overflow-y-auto">
               <WelcomeScreen onExampleClick={handleSend} />
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scrollbar-hide flex flex-col"
            >
              <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-4 md:pt-6 lg:pt-8 pb-4 md:pb-6 lg:pb-8 flex flex-col gap-1">
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
                      className="p-3 md:p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mx-auto my-4 max-w-xl text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Fixed Input Area */}
          <div className="shrink-0 w-full bg-background pb-[env(safe-area-inset-bottom,0px)] pb-3 md:pb-4 lg:pb-6 pt-2 px-3 sm:px-4 lg:px-4 z-20 flex flex-col items-center justify-end">
            <div className="w-full max-w-4xl mx-auto flex flex-col">
              <ChatInput onSend={handleSend} onUploadSuccess={handleUploadSuccess} sessionId={sessionId} disabled={isLoading} />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
