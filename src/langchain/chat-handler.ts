import type { IncomingMessage, ServerResponse } from 'node:http';
import { eaceAgent } from './agent.js';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function writeEvent(res: ServerResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (typeof part === 'string') return part;
    if (part && typeof part === 'object' && 'text' in part) {
      return typeof part.text === 'string' ? part.text : '';
    }
    return '';
  }).join('');
}

function parseBody(req: IncomingMessage): Promise<{ messages?: ChatMessage[] }> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function toolLabel(name: string) {
  return ({
    obter_data_atual: 'Data atual', executar_sql: 'SQL', gerar_grafico: 'Gráfico',
    escolas: 'Escolas', consultar_dados: 'Consulta',
  } as Record<string, string>)[name] ?? name;
}

function sendChartIfPresent(res: ServerResponse, content: unknown) {
  const text = contentToText(content);
  if (!text) return;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.kind === 'apex-chart' && parsed.apex && typeof parsed.apex === 'object') {
      writeEvent(res, { type: 'chart', chart: parsed });
    }
  } catch { /* saída da tool pode não ser JSON */ }
}

export async function handleChat(req: IncomingMessage, res: ServerResponse) {
  const { messages } = await parseBody(req);
  if (!Array.isArray(messages) || messages.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'messages é obrigatório' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const toolIds = new Set<string>();
  let text = '';
  const charts: Record<string, unknown>[] = [];
  try {
    const stream = await eaceAgent.stream({ messages }, { streamMode: 'messages' });
    for await (const item of stream) {
      const [message] = item as unknown as [Record<string, unknown>, Record<string, unknown>];
      const type = typeof message?._getType === 'function'
        ? (message._getType as () => string)() : String(message?.type ?? '');
      if (type === 'error' || type === 'ErrorMessage') {
        console.error('[chat] erro retornado pelo modelo', message);
        writeEvent(res, {
          type: 'error',
          message: 'Não foi possível processar sua solicitação agora. Tente novamente em instantes.',
        });
        continue;
      }
      const toolCalls = Array.isArray(message?.tool_call_chunks) ? message.tool_call_chunks
        : Array.isArray(message?.tool_calls) ? message.tool_calls : [];
      for (const call of toolCalls as Array<Record<string, unknown>>) {
        const id = String(call.id ?? call.tool_call_id ?? '');
        const name = String(call.name ?? 'tool');
        if (id && !toolIds.has(id)) {
          toolIds.add(id);
          writeEvent(res, { type: 'tool', id, name, label: toolLabel(name), status: 'running' });
        }
      }
      if (type === 'tool') {
        const content = message.content;
        sendChartIfPresent(res, content);
        const parsed = (() => { try { return JSON.parse(contentToText(content)); } catch { return null; } })();
        if (parsed?.kind === 'apex-chart') charts.push(parsed);
        const toolCallId = String(message.tool_call_id ?? '');
        if (toolCallId) writeEvent(res, {
          type: 'tool', id: toolCallId, name: String(message.name ?? 'tool'),
          label: toolLabel(String(message.name ?? 'tool')), status: 'done',
        });
        continue;
      }
      const delta = contentToText(message?.content);
      if (delta && (type === 'ai' || type === 'AIMessageChunk' || !type)) {
        text += delta;
        writeEvent(res, { type: 'text', delta });
      }
    }
    const finalText = text.trim() || (charts.length
      ? `Aqui está o gráfico: **${charts.map((c) => c.title).join(', ')}**.`
      : 'Não consegui montar a resposta. Tente de novo.');
    writeEvent(res, { type: 'done', text: finalText, finishReason: 'stop' });
  } catch (error) {
    console.error('[chat] falha ao processar solicitação', error);
    writeEvent(res, {
      type: 'error',
      message: 'Não foi possível processar sua solicitação agora. Tente novamente em instantes.',
    });
    writeEvent(res, { type: 'done', text: text || 'Não consegui processar a solicitação.', finishReason: 'error' });
  } finally {
    res.end();
  }
}
