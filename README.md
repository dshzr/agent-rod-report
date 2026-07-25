# EACE Agent

Agente da EACE usando LangChain/LangGraph, tools de consulta ao Supabase e geração de gráficos ApexCharts.

## Executar

Configure no `.env`:

```shell
OPENCODE_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

Inicie o agente e a interface web:

```shell
npm run dev:all
```

O runtime LangChain expõe `POST http://localhost:4111/api/chat` com resposta SSE. A interface Next.js fica disponível na porta padrão do Next.

O agente está em `src/langchain`. As tools continuam separadas por responsabilidade: SQL read-only, escolas, consulta PostgREST e gráficos.
