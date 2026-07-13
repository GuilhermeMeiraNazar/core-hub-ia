import * as fs from 'fs';
import * as path from 'path';

function findProjectRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, '.env'))) return dir;
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();

function loadDotEnv(envPath: string): Record<string, string> {
    const vars: Record<string, string> = {};
    if (!fs.existsSync(envPath)) return vars;

    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key && !(key in process.env)) {
            vars[key] = value;
        }
    }
    return vars;
}

const dotEnvVars = loadDotEnv(path.join(PROJECT_ROOT, '.env'));

function env(key: string, fallback: string): string {
    return process.env[key] ?? dotEnvVars[key] ?? fallback;
}

export function loadConfig() {
    return {
        // Servidor
        port: parseInt(env('PORT', '3000'), 10),
        host: env('HOST', '0.0.0.0'),

        // GPU
        enableGpu: env('ENABLE_GPU', 'false').toLowerCase() === 'true',

        // Recursos
        resourceUsageLimit: parseFloat(env('RESOURCE_USAGE_LIMIT', '0.6')),
        maxConcurrentRequests: parseInt(env('MAX_CONCURRENT_REQUESTS', '2'), 10),

        // Ollama
        ollamaHost: env('OLLAMA_HOST', 'http://127.0.0.1:11434'),

        // Diretórios
        varDir: path.resolve(PROJECT_ROOT, env('VAR_DIR', './var')),
        contextDir: path.resolve(PROJECT_ROOT, env('CONTEXT_DIR', './var/context')),
        dblanceDir: path.resolve(PROJECT_ROOT, env('DBLANCE_DIR', './var/dblance')),

        // Modelos
        defaultTextModel: env('DEFAULT_TEXT_MODEL', 'qwen2.5:7b'),
        fallbackTextModel: env('FALLBACK_TEXT_MODEL', 'phi3.5'),
        embeddingModel: env('EMBEDDING_MODEL', 'bge-m3'),

        // Raiz do projeto
        projectRoot: PROJECT_ROOT,
    };
}

export type AppConfig = ReturnType<typeof loadConfig>;
