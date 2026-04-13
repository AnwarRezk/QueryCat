# QueryCat AI

A minimal, high-performance RAG application for chatting with your personal documents with multi file upload support and reasoning

## Features
- **Scoped RAG**: Sessions are isolated; chat with specific documents per conversation.
- **Multi-Format**: Native support for PDF, DOCX, and Markdown files.
- **SSE Streaming**: Real-time token streaming with citation tracking.
- **Hybrid AI**: Support for OpenAI (GPT-4o) or local models via Ollama.
- **Modern UI**: Dark-mode glassmorphic interface built with React & Framer Motion.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS v4.
- **Backend**: FastAPI, LangChain, ChromaDB.
- **Vector Model**: `all-MiniLM-L6-v2` (Local).

## Quick Start (Local Dev)
1. **Initial Setup**:
   ```bash
   npm run install:all
   ```
2. **Configuration**:
   Copy `server/.env.example` to `server/.env` and add your `OPENAI_API_KEY`.
3. **Run**:
   ```bash
   npm run dev
   ```
   *Access at http://localhost:5173*

## Deployment (Docker)
Deploy to any VPS in seconds using the baked-in Caddy reverse proxy:
```bash
docker compose up -d --build
```
