import { motion } from 'framer-motion';
import { Cat } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex w-full mb-6 justify-start">
      <div className="flex max-w-[95%] md:max-w-[90%] lg:max-w-[85%] flex-row">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 glass-panel mr-2 md:mr-3">
          <Cat className="w-5 h-5 text-accent-cyan" />
        </div>

        <div className="glass-panel py-3 px-4 rounded-2xl rounded-tl-sm flex items-center space-x-1 border border-white/5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-accent-cyan"
              animate={{
                y: ["0%", "-50%", "0%"],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
