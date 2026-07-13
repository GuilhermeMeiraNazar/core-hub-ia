import express, { Request, Response } from 'express';
import { loadConfig } from './config';
import { OllamaService, ChatMessage } from './ollamaService';
import { ChatManager } from './chatManager';
import { routeRequest, detectRequestType } from './router';
import { RequestQueue } from './requestQueue';

const app = express();
app.use(express.json());

const ollama = new OllamaService();
const chatManager = new ChatManager();
const queue = new RequestQueue();
const config = loadConfig();

/**
 * POST /chat
 * Body: { chatId, message, type?, model? }
 * Envia mensagem, mantém contexto, retorna resposta.
 */
app.post('/chat', async (req: Request, res: Response) => {
    try {
        const { chatId, message, type, model } = req.body;

        if (!chatId || !message) {
            return res.status(400).json({ error: 'chatId e message são obrigatórios.' });
        }

        // Decide qual modelo usar
        const requestType = detectRequestType({ type });
        const route = routeRequest(requestType);
        const selectedModel = model || route.model;

        // Carrega histórico e adiciona mensagem do usuário
        const userMsg: ChatMessage = { role: 'user', content: message };
        const history = chatManager.appendMessage(chatId, userMsg);

        // Envia para o Ollama via fila de requisições
        const response = await queue.enqueue(() => ollama.chat(selectedModel, history));

        // Salva resposta no contexto
        chatManager.appendMessage(chatId, response.message);

        return res.json({
            chatId,
            model: selectedModel,
            response: response.message.content,
            done: response.done,
        });
    } catch (err: any) {
        console.error('[Server] Erro no /chat:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /embed
 * Body: { text, model? }
 * Gera embedding de um texto.
 */
app.post('/embed', async (req: Request, res: Response) => {
    try {
        const { text, model } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text é obrigatório.' });
        }

        const selectedModel = model || config.embeddingModel;
        const result = await queue.enqueue(() => ollama.embed(selectedModel, text));

        return res.json({
            model: selectedModel,
            embedding: result.embedding,
        });
    } catch (err: any) {
        console.error('[Server] Erro no /embed:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /chats
 * Lista todos os chats existentes.
 */
app.get('/chats', (_req: Request, res: Response) => {
    const chats = chatManager.listChats();
    return res.json({ chats });
});

/**
 * GET /chats/:chatId
 * Retorna o histórico de um chat.
 */
app.get('/chats/:chatId', (req: Request, res: Response) => {
    const history = chatManager.loadHistory(req.params.chatId);
    return res.json({ chatId: req.params.chatId, history });
});

/**
 * DELETE /chats/:chatId
 * Remove um chat e seu contexto.
 */
app.delete('/chats/:chatId', (req: Request, res: Response) => {
    chatManager.deleteChat(req.params.chatId);
    return res.json({ ok: true });
});

/**
 * GET /health
 * Verifica saúde do servidor e do Ollama.
 */
app.get('/health', async (_req: Request, res: Response) => {
    const ollamaOk = await ollama.healthCheck();
    return res.json({
        status: ollamaOk ? 'ok' : 'degraded',
        ollama: ollamaOk,
        queue: queue.getStatus(),
    });
});

export { app };
