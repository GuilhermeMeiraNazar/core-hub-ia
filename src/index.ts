import { loadConfig } from './config';
import { OllamaInstaller } from './ollamaInstaller';
import { Installer } from './installer';
import { getSystemResources, printSystemInfo } from './systemInfo';
import { app } from './server';
import { ChildProcess } from 'child_process';

let ollamaProcess: ChildProcess | null = null;

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║         Core Hub IA — Iniciando          ║');
    console.log('╚══════════════════════════════════════════╝');

    const config = loadConfig();
    const ollamaInstaller = new OllamaInstaller();
    const modelInstaller = new Installer();

    // 1. Garantir estrutura de diretórios
    modelInstaller.ensureDirectories();

    // 2. Detectar recursos do sistema
    const resources = getSystemResources();
    printSystemInfo(resources);

    if (!config.enableGpu) {
        console.log('[Config] GPU desabilitada via .env (ENABLE_GPU=false)');
    } else if (resources.vramMb === null) {
        console.log('[Config] GPU habilitada mas não detectada — usando CPU');
    }

    // 3. Instalar Ollama se necessário
    await ollamaInstaller.install();

    // 4. Iniciar Ollama serve se não estiver rodando
    const alreadyRunning = await ollamaInstaller.isRunning();
    if (!alreadyRunning) {
        ollamaProcess = ollamaInstaller.startServe();
        console.log('[Ollama] Aguardando serviço ficar pronto...');
        const ready = await ollamaInstaller.waitForReady();
        if (!ready) {
            console.error('[ERRO] Ollama não respondeu após 30s.');
            process.exit(1);
        }
    }
    console.log('[Ollama] Conectado em:', config.ollamaHost);

    // 5. Verificar/instalar modelos LLM
    await modelInstaller.installAll();

    // 6. Iniciar servidor HTTP
    app.listen(config.port, config.host, () => {
        console.log('');
        console.log(`[Server] Hub IA rodando em http://${config.host}:${config.port}`);
        console.log('[Server] Endpoints:');
        console.log('  POST /chat    — conversa com contexto');
        console.log('  POST /embed   — gera embedding');
        console.log('  GET  /chats   — lista sessões');
        console.log('  GET  /health  — status do sistema');
        console.log('');
    });
}

// Graceful shutdown — para o Ollama junto
process.on('SIGINT', () => {
    console.log('\n[Server] Encerrando...');
    if (ollamaProcess) {
        ollamaProcess.kill();
        console.log('[Ollama] Processo encerrado.');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (ollamaProcess) ollamaProcess.kill();
    process.exit(0);
});

main().catch(err => {
    console.error('[Fatal]', err);
    process.exit(1);
});
