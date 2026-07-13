import { loadConfig } from './config';
import { getSystemResources } from './systemInfo';

type Task<T> = () => Promise<T>;

interface QueueItem<T> {
    task: Task<T>;
    resolve: (value: T) => void;
    reject: (reason: any) => void;
}

/**
 * Fila de requisições com controle de concorrência e verificação de recursos.
 *
 * - Limita requisições simultâneas ao Ollama (MAX_CONCURRENT_REQUESTS)
 * - Verifica se há recursos disponíveis antes de liberar nova requisição
 * - Usa RESOURCE_USAGE_LIMIT como teto de consumo de RAM
 */
export class RequestQueue {
    private queue: QueueItem<any>[] = [];
    private running = 0;
    private maxConcurrent: number;
    private resourceLimit: number;

    constructor() {
        const config = loadConfig();
        this.maxConcurrent = config.maxConcurrentRequests;
        this.resourceLimit = config.resourceUsageLimit;
    }

    /**
     * Enfileira uma tarefa. Se houver slot livre e recursos disponíveis, executa imediatamente.
     * Caso contrário, aguarda na fila.
     */
    public enqueue<T>(task: Task<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.tryNext();
        });
    }

    /**
     * Verifica se o sistema tem recursos livres dentro do limite configurado.
     */
    private hasAvailableResources(): boolean {
        const resources = getSystemResources();
        const usedRamPercent = 1 - (resources.freeRamMb / resources.totalRamMb);

        // Se já estamos acima do limite de uso, bloqueia
        if (usedRamPercent >= this.resourceLimit) {
            console.log(
                `[Queue] RAM em ${(usedRamPercent * 100).toFixed(1)}% — ` +
                `limite é ${(this.resourceLimit * 100).toFixed(0)}%. Aguardando...`
            );
            return false;
        }

        return true;
    }

    /**
     * Tenta executar a próxima tarefa da fila.
     */
    private tryNext(): void {
        if (this.queue.length === 0) return;
        if (this.running >= this.maxConcurrent) return;
        if (!this.hasAvailableResources()) {
            // Tenta novamente em 2s
            setTimeout(() => this.tryNext(), 2000);
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        this.running++;
        console.log(`[Queue] Executando requisição (${this.running}/${this.maxConcurrent} ativos, ${this.queue.length} na fila)`);

        item.task()
            .then(result => {
                item.resolve(result);
            })
            .catch(err => {
                item.reject(err);
            })
            .finally(() => {
                this.running--;
                this.tryNext();
            });
    }

    /**
     * Retorna status atual da fila.
     */
    public getStatus() {
        return {
            running: this.running,
            queued: this.queue.length,
            maxConcurrent: this.maxConcurrent,
            resourceLimit: this.resourceLimit,
        };
    }
}
