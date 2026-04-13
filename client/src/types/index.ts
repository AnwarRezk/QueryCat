export interface DocumentMetadata {
  id: string;
  filename: string;
  uploaded_at: string;
  chunk_count: number;
  size_bytes: number;
  file_type?: string;
  session_id?: string;
}

export interface SourceDocument {
  source: string;
  page: number;
  chunk_index: number;
  content_preview: string;
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  sources?: SourceDocument[];
}
