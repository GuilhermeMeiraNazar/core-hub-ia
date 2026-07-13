import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config';
import modelsJson from './models.json';

interface ModelEntry {
    name: string;
    type: string;
    description: string;
    priority: number;
}

/**
 * Instalador Universal — verifica e puxa modelos via Ollama.
 *
 * Padrão semelhante ao OcrInstaller: isInstalled() + install().
 * Usa o endpoint /api/tags do Ollama para verificar modelos locais
 * e /api/pull para baixar os ausentes.
 */
export class Installer {
    private config = loadConfig();
    private models: ModelEntry[] = modelsJson.models;

    /**
     * Verifica se o Ollama está acessível.
     */
    public async isOllamaRunning(): Promise<boolean> {
        try {
            await axios.get(`${this.config.ollamaHost}/api/tags`, { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retorna a lista de modelos já instalados no Ollama.
     */
    public async getInstalledModels(): Promise<string[]> {
        try {
            const res = await axios.get(`${this.config.ollamaHost}/api/tags`);
            const models = res.data?.models ?? [];
            return models.map((m: { name: string }) => m.name);
        } catch {
            return [];
        }
    }

    /**
     * Verifica quais modelos do models.json estão ausentes.
     */
    public async getMissingModels(): Promise<ModelEntry[]> {
        const installed = await this.getInstalledModels();
        return this.models.filter(m => {
            // Ollama retorna nomes como "qwen2.5:7b" ou "phi3.5:latest"
            return !installed.some(i => i.startsWith(m.name.split(':')[0]));
        });
    }

    /**
     * Puxa um modelo específico via Ollama.
     */
    public async pullModel(modelName: string): Promise<void> {
        console.log(`[Installer] Puxando modelo: ${modelName}...`);
        try {
            await axios.post(
                `${this.config.ollamaHost}/api/pull`,
                { name: modelName, stream: false },
                { timeout: 0 } // sem timeout — modelos são grandes
            );
            console.log(`[Installer] ✓ ${modelName} instalado.`);
        } catch (err: any) {
            throw new Error(`[Installer] Falha ao puxar ${modelName}: ${err.message}`);
        }
    }

    /**
     * Instala todos os modelos ausentes.
     * Retorna true se tudo foi instalado com sucesso.
     */
    public async installAll(): Promise<boolean> {
        const missing = await this.getMissingModels();

        if (missing.length === 0) {
            console.log('[Installer] Todos os modelos já estão instalados.');
            return true;
        }

        console.log(`[Installer] ${missing.length} modelo(s) ausente(s):`);
        for (const m of missing) {
            console.log(`  - ${m.name} (${m.description})`);
        }

        for (const m of missing) {
            await this.pullModel(m.name);
        }

        return true;
    }

    /**
     * Garante que as pastas do var/ existam.
     */
    public ensureDirectories(): void {
        const dirs = [
            this.config.varDir,
            this.config.contextDir,
            this.config.dblanceDir,
            path.join(this.config.varDir, 'ollama'),
            path.join(this.config.varDir, 'models'),
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`[Installer] Criado: ${dir}`);
            }
        }
    }
}
