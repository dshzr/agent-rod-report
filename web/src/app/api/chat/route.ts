import type { ChatMessage } from '@/lib/chat';

export const runtime = 'nodejs';
export const maxDuration = 120;

const AGENT_URL = process.env.AGENT_URL?.replace(/\/$/, '') || 'http://localhost:4111';

export async function POST(req: Request) {
  const body = await req.json();
  const messages = (body.messages ?? []) as ChatMessage[];

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages é obrigatório' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${AGENT_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages }),
      signal: req.signal,
    });

    if (!upstream.ok || !upstream.body) {
      await upstream.text().catch(() => '');
      return Response.json(
        { error: 'Não foi possível processar sua solicitação agora. Tente novamente em instantes.' },
        { status: 502 },
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[api/chat] falha ao conectar ao agente', error);
    return Response.json(
      { error: 'Não foi possível conectar ao serviço agora. Tente novamente em instantes.' },
        { status: 502 },
    );
  }
}
