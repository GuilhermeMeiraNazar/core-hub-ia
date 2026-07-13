import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config';
import { ChatMessage } from './ollamaService';

/**
 * Gerencia sessões de chat com persistência de contexto.
 * Cada chat ID tem um arquivo JSON em var/context/{chatId}.json.
 */
export class ChatManager {
    private contextDir: string;

    constructor() {
        this.contextDir = loadConfig().contextDir;
        if (!fs.existsSync(this.contextDir)) {
            fs.mkdirSync(this.contextDir, { recursive: true });
        }
    }

    /**
     * Retorna o caminho do arquivo de contexto para um chat.
     */
    private getContextPath(chatId: string): string {
        // Sanitiza o chatId para uso em filesystem
        const safe = chatId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.contextDir, `${safe}.json`);
    }

    /**
     * Carrega o histórico de mensagens de um chat.
     */
    public loadHistory(chatId: string): ChatMessage[] {
        const filePath = this.getContextPath(chatId);
        if (!fs.existsSync(filePath)) return [];

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(raw) as ChatMessage[];
        } catch {
            return [];
        }
    }

    /**
     * Salva o histórico atualizado de um chat.
     */
    public saveHistory(chatId: string, messages: ChatMessage[]): void {
        const filePath = this.getContextPath(chatId);
        fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf8');
    }

    /**
     * Adiciona uma mensagem ao histórico e salva.
     */
    public appendMessage(chatId: string, message: ChatMessage): ChatMessage[] {
        const history = this.loadHistory(chatId);
        history.push(message);
        this.saveHistory(chatId, history);
        return history;
    }

    /**
     * Lista todos os chats existentes.
     */
    public listChats(): string[] {
        if (!fs.existsSync(this.contextDir)) return [];
        return fs.readdirSync(this.contextDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    }

    /**
     * Remove o contexto de um chat.
     */
    public deleteChat(chatId: string): void {
        const filePath = this.getContextPath(chatId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}
