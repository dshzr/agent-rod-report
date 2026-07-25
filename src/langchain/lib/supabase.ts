export type QueryFilter = {
  column: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';
  value: string | number | boolean | null;
};

export type QueryOptions = {
  select?: string;
  filters?: QueryFilter[];
  order?: string;
  limit?: number;
};

const FORBIDDEN_SQL =
  /\b(insert|update|delete|merge|drop|alter|truncate|create|grant|revoke|copy|call|execute|do|refresh|reindex|vacuum|cluster|comment|security)\b/i;

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    throw new Error(
      'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) no .env',
    );
  }

  return { url, apiKey };
}

function encodeFilterValue(value: QueryFilter['value']): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  return String(value);
}

/** Consulta PostgREST em uma tabela. */
export async function supabaseQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  table: string,
  options: QueryOptions = {},
): Promise<T[]> {
  const { url, apiKey } = getConfig();
  const params = new URLSearchParams();
  params.set('select', options.select || '*');
  params.set('limit', String(options.limit ?? 50));

  if (options.order) params.set('order', options.order);

  for (const filter of options.filters ?? []) {
    params.append(filter.column, `${filter.op}.${encodeFilterValue(filter.value)}`);
  }

  const response = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text || response.statusText}`);
  }

  return (text ? JSON.parse(text) : []) as T[];
}

/** Valida SQL read-only (somente SELECT / WITH). */
export function assertSelectOnly(sql: string): string {
  let q = sql.trim();
  if (!q) throw new Error('SQL vazio');

  q = q.replace(/;\s*$/, '');
  if (q.includes(';')) {
    throw new Error('Apenas um statement SELECT é permitido');
  }

  const check = q
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .toLowerCase();

  if (!/^(with|select)(\s|\()/.test(check)) {
    throw new Error('Apenas SELECT (ou WITH ... SELECT) é permitido');
  }

  if (FORBIDDEN_SQL.test(check)) {
    throw new Error('Comando não permitido — somente SELECT');
  }

  return q;
}

/** Executa SQL via RPC `public.executar_sql`. */
export async function supabaseSql(
  query: string,
  maxRows = 200,
): Promise<{ rows: Record<string, unknown>[]; count: number }> {
  const { url, apiKey } = getConfig();
  const safe = assertSelectOnly(query);
  const limit = Math.min(Math.max(maxRows, 1), 500);

  const response = await fetch(`${url}/rest/v1/rpc/executar_sql`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_query: safe, p_max_rows: limit }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase SQL ${response.status}: ${text || response.statusText}`);
  }

  const payload = text ? JSON.parse(text) : { rows: [], count: 0 };
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const count = typeof payload?.count === 'number' ? payload.count : rows.length;

  return { rows, count };
}
