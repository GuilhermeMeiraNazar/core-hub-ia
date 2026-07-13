import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testChat() {
    console.log('=== Teste de Chat com Hub IA ===\n');

    const chatId = `test-${Date.now()}`;

    // Primeira mensagem
    console.log('[1] Enviando primeira mensagem...');
    const res1 = await axios.post(`${BASE_URL}/chat`, {
        chatId,
        message: 'Olá! Me explique em uma frase o que é inteligência artificial.',
    });
    console.log(`Modelo: ${res1.data.model}`);
    console.log(`Resposta: ${res1.data.response}\n`);

    // Segunda mensagem (testa contexto)
    console.log('[2] Enviando segunda mensagem (teste de contexto)...');
    const res2 = await axios.post(`${BASE_URL}/chat`, {
        chatId,
        message: 'Agora me dê um exemplo prático disso.',
    });
    console.log(`Resposta: ${res2.data.response}\n`);

    // Verificar histórico
    console.log('[3] Verificando histórico...');
    const res3 = await axios.get(`${BASE_URL}/chats/${chatId}`);
    console.log(`Mensagens no histórico: ${res3.data.history.length}\n`);

    // Health check
    console.log('[4] Health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log(`Status: ${health.data.status}`);
    console.log(`Ollama: ${health.data.ollama ? 'conectado' : 'desconectado'}\n`);

    console.log('=== Teste concluído ===');
}

testChat().catch(err => {
    console.error('Erro no teste:', err.response?.data || err.message);
    process.exit(1);
});
