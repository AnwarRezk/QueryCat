FROM python:3.12-slim

WORKDIR /app

# Install system deps for python-docx (lxml) and pypdf + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libxml2-dev libxslt1-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# Copy application code
COPY . .

# Create storage directories
RUN mkdir -p uploads chroma_data sessions

# Expose port
EXPOSE 3001

# Run with production uvicorn settings
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "3001", \
     "--workers", "1", \
     "--timeout-keep-alive", "120"]
