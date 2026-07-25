export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ApexChartPayload = {
  kind: 'apex-chart';
  title: string;
  apex: Record<string, unknown>;
};

export type ToolStatus = 'running' | 'done' | 'error';

/** Eventos SSE enviados pelo backend Next (LangChain nunca é exposto ao browser). */
export type ClientStreamEvent =
  | { type: 'text'; delta: string; replace?: boolean }
  | { type: 'reasoning'; delta: string; replace?: boolean }
  | { type: 'tool'; id: string; name: string; label: string; status: ToolStatus }
  | { type: 'chart'; chart: ApexChartPayload }
  | { type: 'done'; text: string; reasoning?: string; finishReason: string | null }
  | { type: 'error'; message: string };

const TOOL_LABELS: Record<string, string> = {
  executarSql: 'SQL',
  gerarGrafico: 'Gráfico',
  escolas: 'Escolas',
  consultarDados: 'Consulta',
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return value;
  try {
    return JSON.parse(t);
  } catch {
    return value;
  }
}

function unwrapToolOutput(output: unknown): unknown {
  const parsed = tryParseJson(output);
  if (!parsed || typeof parsed !== 'object') return parsed;
  const o = parsed as Record<string, unknown>;
  if (o.type === 'json' && 'value' in o) return tryParseJson(o.value);
  if (o.type === 'text' && 'value' in o) return tryParseJson(o.value);
  if ('result' in o) return tryParseJson(o.result);
  return parsed;
}

export function asChart(value: unknown): ApexChartPayload | null {
  const v0 = unwrapToolOutput(value);
  if (!v0 || typeof v0 !== 'object' || Array.isArray(v0)) return null;
  const v = v0 as Record<string, unknown>;

  if (v.kind === 'apex-chart' && v.apex && typeof v.apex === 'object') {
    return {
      kind: 'apex-chart',
      title: typeof v.title === 'string' ? v.title : 'Gráfico',
      apex: v.apex as Record<string, unknown>,
    };
  }

  if (v.apex && typeof v.apex === 'object' && !('error' in v)) {
    return {
      kind: 'apex-chart',
      title: typeof v.title === 'string' ? v.title : 'Gráfico',
      apex: v.apex as Record<string, unknown>,
    };
  }

  return null;
}

export function buildAssistantText(text: string, charts: ApexChartPayload[]): string {
  const trimmed = text.trim();
  const short = !trimmed || /^(pronto\.?|ok\.?|feito\.?)$/i.test(trimmed);

  if (charts.length > 0 && short) {
    const titles = charts.map((c) => c.title).join(', ');
    return `Aqui está o gráfico: **${titles}**.`;
  }

  if (!trimmed && charts.length === 0) {
    return 'Não consegui montar a resposta. Tente de novo.';
  }

  return trimmed;
}

type LangChainChunk = {
  type?: string;
  payload?: Record<string, unknown>;
};

/**
 * Converte chunks SSE do LangChain em eventos limpos para o browser.
 * Deduplica tool-call/tool-result (o stream às vezes repete).
 */
function extractReasoningFallback(payload: Record<string, unknown>): string {
  // finish/step às vezes guardam a resposta só em reasoning (bug do modelo)
  const tryMsg = (msg: unknown): string => {
    if (!msg || typeof msg !== 'object') return '';
    const content = (msg as { content?: unknown }).content;
    if (!Array.isArray(content)) return '';
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: string }).type === 'reasoning' &&
        typeof (part as { text?: string }).text === 'string'
      ) {
        return (part as { text: string }).text.trim();
      }
    }
    return '';
  };

  const messages = payload.messages as
    | { nonUser?: unknown[]; all?: unknown[] }
    | undefined;
  for (const msg of messages?.nonUser ?? []) {
    const t = tryMsg(msg);
    if (t) return t;
  }
  for (const msg of messages?.all ?? []) {
    const t = tryMsg(msg);
    if (t) return t;
  }

  const ui = (payload as { response?: { uiMessages?: unknown[] } }).response
    ?.uiMessages;
  if (Array.isArray(ui)) {
    for (const m of ui) {
      if (!m || typeof m !== 'object') continue;
      const parts = (m as { parts?: unknown[] }).parts;
      if (!Array.isArray(parts)) continue;
      for (const p of parts) {
        if (
          p &&
          typeof p === 'object' &&
          (p as { type?: string }).type === 'reasoning' &&
          typeof (p as { text?: string }).text === 'string'
        ) {
          return (p as { text: string }).text.trim();
        }
      }
    }
  }

  return '';
}

export function createLangChainStreamTranslator() {
  const seenToolStart = new Set<string>();
  const seenToolDone = new Set<string>();
  const seenChart = new Set<string>();
  const pending: ClientStreamEvent[] = [];
  let text = '';
  let reasoning = '';
  let hasText = false;
  let finishReason: string | null = null;
  let sawFinish = false;

  function onChunk(chunk: LangChainChunk) {
    const type = chunk.type;
    const payload = chunk.payload ?? {};

    // Reasoning fica em canal próprio (UI "Pensando") — nunca vaza como resposta
    if (type === 'reasoning-delta') {
      const delta = typeof payload.text === 'string' ? payload.text : '';
      if (!delta) return;
      reasoning += delta;
      pending.push({ type: 'reasoning', delta });
      return;
    }

    if (type === 'text-delta') {
      const delta = typeof payload.text === 'string' ? payload.text : '';
      if (!delta) return;

      if (!hasText) {
        hasText = true;
        text = delta;
        pending.push({ type: 'text', delta: text, replace: true });
        return;
      }

      text += delta;
      pending.push({ type: 'text', delta });
      return;
    }

    if (type === 'tool-call-input-streaming-start' || type === 'tool-call') {
      const id = typeof payload.toolCallId === 'string' ? payload.toolCallId : '';
      const name = typeof payload.toolName === 'string' ? payload.toolName : 'tool';
      if (!id || seenToolStart.has(id)) return;
      seenToolStart.add(id);
      pending.push({
        type: 'tool',
        id,
        name,
        label: toolLabel(name),
        status: 'running',
      });
      return;
    }

    if (type === 'tool-result') {
      const id = typeof payload.toolCallId === 'string' ? payload.toolCallId : '';
      const name = typeof payload.toolName === 'string' ? payload.toolName : 'tool';
      if (!id || seenToolDone.has(id)) return;
      seenToolDone.add(id);

      const result = payload.result ?? payload;
      const hasError =
        !!result &&
        typeof result === 'object' &&
        'error' in result &&
        Boolean((result as { error?: unknown }).error);

      pending.push({
        type: 'tool',
        id,
        name,
        label: toolLabel(name),
        status: hasError ? 'error' : 'done',
      });

      const chart = asChart(result);
      if (chart) {
        const key = JSON.stringify(chart.apex);
        if (!seenChart.has(key)) {
          seenChart.add(key);
          pending.push({ type: 'chart', chart });
        }
      }
      return;
    }

    if (type === 'error') {
      const message =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.message === 'string'
            ? payload.message
            : 'Erro no stream do agente';
      pending.push({ type: 'error', message });
      return;
    }

    if (type === 'finish' || type === 'step-finish') {
      sawFinish = true;
      const step = payload.stepResult as { reason?: string } | undefined;
      if (typeof step?.reason === 'string') finishReason = step.reason;

      if (!hasText && !reasoning) {
        const fallback = extractReasoningFallback(payload);
        if (fallback) {
          reasoning = fallback;
          pending.push({ type: 'reasoning', delta: fallback, replace: true });
        }
      }
    }
  }

  function flush(): ClientStreamEvent[] {
    return pending.splice(0, pending.length);
  }

  function getText() {
    return (hasText ? text : reasoning).trim();
  }

  function getReasoning() {
    return reasoning.trim();
  }

  return {
    onChunk,
    flush,
    getText,
    getReasoning,
    getFinishReason: () => finishReason,
    sawFinish: () => sawFinish,
  };
}

export function parseSseDataLine(line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const raw = trimmed.slice(5).trim();
  if (!raw || raw === '[DONE]') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
