import axios from 'axios';
import { loadConfig } from './config';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatResponse {
    model: string;
    message: ChatMessage;
    done: boolean;
    totalDuration?: number;
}

export interface EmbeddingResponse {
    embedding: number[];
}

/**
 * Serviço de comunicação com o Ollama.
 * Encapsula chamadas de chat e embeddings.
 */
export class OllamaService {
    private host: string;

    constructor() {
        this.host = loadConfig().ollamaHost;
    }

    /**
     * Envia mensagens para gerar resposta via chat.
     * O modelo é carregado sob demanda pelo Ollama e descarregado após inatividade.
     */
    public async chat(model: string, messages: ChatMessage[]): Promise<ChatResponse> {
        const res = await axios.post(`${this.host}/api/chat`, {
            model,
            messages,
            stream: false,
        }, { timeout: 0 });

        return res.data;
    }

    /**
     * Gera embedding de um texto (para RAG futuro).
     */
    public async embed(model: string, input: string): Promise<EmbeddingResponse> {
        const res = await axios.post(`${this.host}/api/embeddings`, {
            model,
            prompt: input,
        }, { timeout: 30000 });

        return res.data;
    }

    /**
     * Verifica se o Ollama está respondendo.
     */
    public async healthCheck(): Promise<boolean> {
        try {
            await axios.get(`${this.host}/api/tags`, { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }
}
