import { loadConfig } from './config';

export type RequestType = 'text' | 'embedding' | 'rag';

interface RouteResult {
    model: string;
    type: RequestType;
}

/**
 * Roteador de requisições — decide qual modelo usar baseado no tipo de pedido.
 * Futuramente pode usar lógica mais complexa (tamanho do prompt, prioridade, etc).
 */
export function routeRequest(type: RequestType): RouteResult {
    const config = loadConfig();

    switch (type) {
        case 'embedding':
            return { model: config.embeddingModel, type: 'embedding' };

        case 'rag':
            // RAG usa embedding para busca + texto para resposta
            return { model: config.defaultTextModel, type: 'rag' };

        case 'text':
        default:
            return { model: config.defaultTextModel, type: 'text' };
    }
}

/**
 * Determina o tipo de requisição a partir do body do request.
 */
export function detectRequestType(body: { type?: string }): RequestType {
    const t = body.type?.toLowerCase();
    if (t === 'embedding') return 'embedding';
    if (t === 'rag') return 'rag';
    return 'text';
}
