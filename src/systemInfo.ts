import * as os from 'os';
import { execSync } from 'child_process';

export interface SystemResources {
    cpus: number;
    totalRamMb: number;
    freeRamMb: number;
    vramMb: number | null; // null se não detectar GPU
    platform: string;
}

/**
 * Detecta recursos do sistema: CPUs, RAM e VRAM (se disponível).
 */
export function getSystemResources(): SystemResources {
    const cpus = os.cpus().length;
    const totalRamMb = Math.round(os.totalmem() / 1024 / 1024);
    const freeRamMb = Math.round(os.freemem() / 1024 / 1024);
    const platform = os.platform();

    let vramMb: number | null = null;

    try {
        if (platform === 'win32') {
            // nvidia-smi para Windows
            const output = execSync(
                'nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits',
                { encoding: 'utf8', timeout: 5000 }
            );
            const value = parseInt(output.trim().split('\n')[0], 10);
            if (!isNaN(value)) vramMb = value;
        } else if (platform === 'linux') {
            // Tenta nvidia-smi no Linux
            const output = execSync(
                'nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits',
                { encoding: 'utf8', timeout: 5000 }
            );
            const value = parseInt(output.trim().split('\n')[0], 10);
            if (!isNaN(value)) vramMb = value;
        }
    } catch {
        // GPU não disponível — ok, segue sem
        vramMb = null;
    }

    return { cpus, totalRamMb, freeRamMb, vramMb, platform };
}

/**
 * Imprime resumo dos recursos no console.
 */
export function printSystemInfo(res: SystemResources): void {
    console.log('[System] ─────────────────────────────────────');
    console.log(`[System] Platform:  ${res.platform}`);
    console.log(`[System] CPUs:      ${res.cpus}`);
    console.log(`[System] RAM Total: ${res.totalRamMb} MB`);
    console.log(`[System] RAM Livre: ${res.freeRamMb} MB`);
    if (res.vramMb !== null) {
        console.log(`[System] VRAM:      ${res.vramMb} MB`);
    } else {
        console.log(`[System] VRAM:      não detectada (modo CPU)`);
    }
    console.log('[System] ─────────────────────────────────────');
}
