'use client';

import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { ApexChartView } from './ApexChartView';
import { MarkdownView } from './MarkdownView';
import { SpikeMark } from './SpikeMark';
import { ThinkingBlock } from './ThinkingBlock';
import type {
  ApexChartPayload,
  ChatMessage,
  ClientStreamEvent,
  ToolStatus,
} from '@/lib/chat';

type ToolChip = {
  id: string;
  name: string;
  label: string;
  status: ToolStatus;
};

type UiMessage = ChatMessage & {
  id: string;
  charts?: ApexChartPayload[];
  tools?: ToolChip[];
  reasoning?: string;
  streaming?: boolean;
};

const SUGGESTIONS = [
  'Quantas escolas conectadas tem na fase 4?',
  'Gráfico de barras das conectadas por UF (top 10)',
  'Donut de tecnologia das escolas conectadas',
  'Bubble de escolas por região',
];

function parseSseChunk(block: string): ClientStreamEvent | null {
  for (const line of block.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const raw = t.slice(5).trim();
    if (!raw) continue;
    try {
      return JSON.parse(raw) as ClientStreamEvent;
    } catch {
      return null;
    }
  }
  return null;
}

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  if (role === 'user') {
    return (
      <div className="avatar avatar--user" aria-hidden>
        <span>V</span>
      </div>
    );
  }
  return (
    <div className="avatar avatar--assistant" aria-hidden>
      <SpikeMark />
    </div>
  );
}

export function ChatApp() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function patchAssistant(id: string, patch: (msg: UiMessage) => UiMessage) {
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const userMsg: UiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: UiMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: '',
      charts: [],
      tools: [],
      streaming: true,
    };

    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    scrollToBottom();
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Falha no chat');
      }

      if (!res.body) throw new Error('Resposta sem stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accText = '';
      let accReasoning = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const ev = parseSseChunk(part);
          if (!ev) continue;

          if (ev.type === 'reasoning') {
            accReasoning = ev.replace
              ? ev.delta
              : accReasoning + ev.delta;
            const snap = accReasoning;
            patchAssistant(assistantId, (m) => ({
              ...m,
              reasoning: snap,
            }));
            scrollToBottom();
          }

          if (ev.type === 'text') {
            accText = ev.replace ? ev.delta : accText + ev.delta;
            const snapshot = accText;
            patchAssistant(assistantId, (m) => ({
              ...m,
              content: snapshot,
            }));
            scrollToBottom();
          }

          if (ev.type === 'tool') {
            patchAssistant(assistantId, (m) => {
              const tools = [...(m.tools ?? [])];
              const idx = tools.findIndex((t) => t.id === ev.id);
              const chip: ToolChip = {
                id: ev.id,
                name: ev.name,
                label: ev.label,
                status: ev.status,
              };
              if (idx >= 0) tools[idx] = chip;
              else tools.push(chip);
              return { ...m, tools };
            });
            scrollToBottom();
          }

          if (ev.type === 'chart') {
            patchAssistant(assistantId, (m) => ({
              ...m,
              charts: [...(m.charts ?? []), ev.chart],
            }));
            scrollToBottom();
          }

          if (ev.type === 'error') {
            setError('Não foi possível processar sua solicitação agora. Tente novamente em instantes.');
          }

          if (ev.type === 'done') {
            const finalText = ev.text || accText;
            const finalReasoning = ev.reasoning ?? accReasoning;
            patchAssistant(assistantId, (m) => ({
              ...m,
              reasoning: finalReasoning || m.reasoning,
              content:
                finalText ||
                (m.charts?.length
                  ? 'Aqui está o gráfico.'
                  : 'Não consegui montar a resposta. Tente de novo.'),
              streaming: false,
            }));
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setError('Não foi possível processar sua solicitação agora. Tente novamente em instantes.');
      patchAssistant(assistantId, (m) => ({
        ...m,
        streaming: false,
        content: m.content || 'Não consegui montar a resposta. Tente de novo.',
      }));
    } finally {
      setLoading(false);
      patchAssistant(assistantId, (m) => ({ ...m, streaming: false }));
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <SpikeMark className="brand__mark" />
            <div className="brand__text">
              <p className="brand__name">EACE Agent</p>
              <p className="brand__sub">Portal Aprender Conectado</p>
            </div>
          </div>
          <p className="topbar__hint">Dados · SQL · gráficos ao vivo</p>
        </div>
      </header>

      <main className={`stage ${empty ? 'stage--empty' : ''}`}>
        <div className="thread">
          {empty && (
            <section className="welcome">
              <div className="welcome__mark" aria-hidden>
                <SpikeMark />
              </div>
              <h1 className="welcome__title">Como posso ajudar?</h1>
              <p className="welcome__sub">
                Consulte escolas do programa, agregue por região ou UF e peça
                gráficos — tudo em tempo real.
              </p>
              <div className="prompts">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="prompt"
                    onClick={() => void sendMessage(s)}
                    disabled={loading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}

          {messages.map((m) => (
            <article key={m.id} className={`turn turn--${m.role}`}>
              <Avatar role={m.role} />
              <div className="turn__body">
                <p className="turn__role">
                  {m.role === 'user' ? 'Você' : 'EACE'}
                </p>

                {m.role === 'assistant' && !!m.tools?.length && (
                  <div className="tool-row" aria-live="polite">
                    {m.tools.map((t) => (
                      <span
                        key={t.id}
                        className={`tool-chip tool-chip--${t.status}`}
                        title={t.name}
                      >
                        <span className="tool-chip__dot" />
                        {t.label}
                        {t.status === 'running'
                          ? '…'
                          : t.status === 'done'
                            ? ''
                            : ' !'}
                      </span>
                    ))}
                  </div>
                )}

                {m.role === 'assistant' ? (
                  <>
                    {!!m.reasoning?.trim() &&
                      !(
                        !m.streaming &&
                        m.content.trim() === m.reasoning.trim()
                      ) && (
                        <ThinkingBlock
                          content={m.reasoning}
                          active={!!m.streaming && !m.content}
                        />
                      )}

                    {m.content ? (
                      <div className="turn__content">
                        <MarkdownView content={m.content} />
                        {m.streaming && <span className="caret" aria-hidden />}
                      </div>
                    ) : m.streaming && !m.reasoning?.trim() ? (
                      <div className="thinking" aria-live="polite">
                        <span className="thinking__dot" />
                        <span className="thinking__dot" />
                        <span className="thinking__dot" />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="user-bubble">{m.content}</div>
                )}

                {m.charts?.map((c, i) => (
                  <ApexChartView
                    key={`${m.id}-${i}`}
                    title={c.title}
                    apex={c.apex}
                  />
                ))}
              </div>
            </article>
          ))}

          {error && <p className="error">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="dock">
        <form className="composer" onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={onKeyDown}
            placeholder="Pergunte sobre escolas, totais ou peça um gráfico…"
            disabled={loading}
            rows={1}
            aria-label="Mensagem"
          />
          <button
            type="submit"
            className="send"
            disabled={loading || !input.trim()}
            aria-label="Enviar"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                fill="currentColor"
                d="M3.4 20.6 21 12 3.4 3.4l-.1 6.8L15 12 3.3 13.8z"
              />
            </svg>
          </button>
        </form>
        <p className="dock__note">
          Enter envia · Shift+Enter quebra linha · respostas e tools em stream
        </p>
      </footer>
    </div>
  );
}
