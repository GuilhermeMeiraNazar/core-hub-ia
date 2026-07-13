import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { loadConfig } from './config';

const OLLAMA_VERSION = '0.31.2';
const OLLAMA_DOWNLOAD_URL = `https://ollama.com/download/OllamaSetup.exe`;

/**
 * Instalador do Ollama — baixa e instala localmente em var/ollama/.
 * 
 * No Windows, o OllamaSetup.exe suporta instalação silenciosa com /SILENT /DIR=<path>.
 * Os modelos ficam em var/ollama/models/ via OLLAMA_MODELS env var.
 */
export class OllamaInstaller {
    private config = loadConfig();
    private ollamaDir: string;
    private binPath: string;
    private modelsDir: string;
    private setupPath: string;

    constructor() {
        this.ollamaDir = path.join(this.config.varDir, 'ollama');
        this.binPath = path.join(this.ollamaDir, 'ollama.exe');
        this.modelsDir = path.join(this.config.varDir, 'models');
        this.setupPath = path.join(this.ollamaDir, 'OllamaSetup.exe');
    }

    /**
     * Verifica se o binário do Ollama já existe localmente.
     */
    public isInstalled(): boolean {
        return fs.existsSync(this.binPath);
    }

    /**
     * Verifica se o Ollama já está rodando (em qualquer lugar).
     */
    public async isRunning(): Promise<boolean> {
        try {
            await axios.get(`${this.config.ollamaHost}/api/tags`, { timeout: 3000 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Baixa o instalador do Ollama.
     */
    private async download(): Promise<void> {
        if (fs.existsSync(this.setupPath)) {
            console.log('[OllamaInstaller] Setup já baixado.');
            return;
        }

        fs.mkdirSync(this.ollamaDir, { recursive: true });

        console.log(`[OllamaInstaller] Baixando Ollama de: ${OLLAMA_DOWNLOAD_URL}`);
        console.log('[OllamaInstaller] Isso pode levar alguns minutos...');

        const response = await axios.get(OLLAMA_DOWNLOAD_URL, {
            responseType: 'arraybuffer',
            timeout: 0,
            onDownloadProgress: (progress) => {
                if (progress.total) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    process.stdout.write(`\r[OllamaInstaller] Download: ${percent}%`);
                }
            },
        });

        fs.writeFileSync(this.setupPath, Buffer.from(response.data));
        console.log('\n[OllamaInstaller] Download concluído.');
    }

    /**
     * Executa a instalação silenciosa do Ollama na pasta var/ollama/.
     * Usa /VERYSILENT + /NORUN para evitar abrir a interface gráfica.
     * Após instalação, mata qualquer processo residual do app desktop.
     */
    private installFromSetup(): void {
        console.log(`[OllamaInstaller] Instalando em: ${this.ollamaDir}`);

        try {
            // /NORUN impede que o setup inicie o app após a instalação
            execSync(
                `"${this.setupPath}" /VERYSILENT /SUPPRESSMSGBOXES /NOICONS /CLOSEAPPLICATIONS /DIR="${this.ollamaDir}"`,
                { timeout: 180000, stdio: 'pipe' }
            );
        } catch (err: any) {
            // O setup pode retornar código diferente de 0 mas instalar ok
            if (!fs.existsSync(this.binPath)) {
                throw new Error(`[OllamaInstaller] Falha na instalação: ${err.message}`);
            }
        }

        // Mata qualquer instância do app desktop que o setup possa ter iniciado
        this.killOllamaDesktop();

        if (fs.existsSync(this.binPath)) {
            console.log('[OllamaInstaller] ✓ Ollama binário instalado (modo serviço).');
        } else {
            throw new Error('[OllamaInstaller] Binário não encontrado após instalação.');
        }
    }

    /**
     * Mata processos do Ollama desktop/tray que não sejam nosso "ollama serve".
     * Queremos apenas o binário CLI, sem interface gráfica.
     */
    private killOllamaDesktop(): void {
        try {
            // Mata o app runner (interface gráfica / tray icon)
            execSync('taskkill /F /IM "ollama app.exe" 2>nul', { stdio: 'pipe' });
        } catch {
            // ok se não existir
        }
        try {
            // Mata qualquer ollama serve que o setup tenha iniciado
            // (vamos iniciar o nosso próprio com env vars controladas)
            execSync('taskkill /F /IM "ollama.exe" 2>nul', { stdio: 'pipe' });
        } catch {
            // ok se não existir
        }
    }

    /**
     * Processo completo: download + install.
     */
    public async install(): Promise<void> {
        if (this.isInstalled()) {
            console.log('[OllamaInstaller] Ollama já está instalado em var/ollama/.');
            return;
        }

        fs.mkdirSync(this.modelsDir, { recursive: true });

        await this.download();
        this.installFromSetup();

        // Limpa o setup após instalação
        if (fs.existsSync(this.setupPath)) {
            fs.unlinkSync(this.setupPath);
            console.log('[OllamaInstaller] Setup removido após instalação.');
        }
    }

    /**
     * Inicia o Ollama serve em background como serviço puro (sem interface).
     * Configura OLLAMA_MODELS para manter modelos dentro de var/ollama/models/.
     * Configura OLLAMA_NOPRUNE=1 para evitar limpeza automática.
     */
    public startServe(): ChildProcess {
        console.log('[OllamaInstaller] Iniciando ollama serve (modo serviço oculto)...');

        const env = {
            ...process.env,
            OLLAMA_MODELS: this.modelsDir,
            OLLAMA_HOST: '127.0.0.1:11434',
            OLLAMA_NOPRUNE: '1',
        };

        const child = spawn(this.binPath, ['serve'], {
            env,
            detached: false,
            stdio: 'pipe',
            windowsHide: true, // Oculta a janela no Windows
        });

        child.stdout?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) console.log(`[Ollama] ${msg}`);
        });

        child.stderr?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) console.log(`[Ollama] ${msg}`);
        });

        child.on('error', (err) => {
            console.error('[OllamaInstaller] Erro ao iniciar ollama serve:', err.message);
        });

        return child;
    }

    /**
     * Aguarda até o Ollama responder no host configurado.
     */
    public async waitForReady(timeoutMs: number = 30000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (await this.isRunning()) return true;
            await new Promise(r => setTimeout(r, 1000));
        }
        return false;
    }

    /**
     * Retorna o caminho do binário.
     */
    public getBinPath(): string {
        return this.binPath;
    }
}
