# DocChat: Personal AI Document Assistant

A full-stack Retrieval-Augmented Generation (RAG) application. Upload your PDFs and chat with an AI that understands their contents. 

## Features
* **Modern UI**: Dark-mode glassmorphism design with React, Vite, Tailwind CSS, and Framer Motion.
* **Server-Sent Events (SSE)**: Real-time token streaming in the chat interface.
* **FastAPI Backend**: Highly concurrent ASGI backend in Python.
* **Vector Search**: Local ChromaDB instance with `all-MiniLM-L6-v2` embeddings.
* **Model Flexibility**: Choose between OpenAI (GPT-4o) and Ollama (local, free) via `.env`.

## Setup Instructions

### Prerequisites
* Python 3.11+
* Node.js 22+
* (Optional) [Ollama](https://ollama.com/) if you want to run models locally for free.

### Backend Setup
1. Open the `server` directory.
2. Copy `.env.example` to `.env` and configure `USE_OPENAI` (True for OpenAI API, False for Ollama).
3. Create a virtual environment: `python -m venv .venv && source .venv/bin/activate` or use your system python.
4. Install requirements: `pip install -r requirements.txt`.

### Frontend Setup
1. Open the `client` directory.
2. Run `npm install` to install React and Tailwind dependencies.

### Running the App
Run everything together from the root directory using `concurrently`:
```bash
npm run install:all   # Installs frontend and backend deps
npm run dev           # Starts both Vite client on 5173 and FastAPI on 3001
```

Once running, navigate to `http://localhost:5173` to use DocChat. 
