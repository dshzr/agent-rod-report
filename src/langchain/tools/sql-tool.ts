import { tool } from 'langchain';
import { z } from 'zod';
import { supabaseSql } from '../lib/supabase.js';

export const sqlTool = tool(
  async (input) => {
    const { rows, count } = await supabaseSql(input.sql, input.maxRows ?? 200);
    const sql = input.sql.trim().replace(/;\s*$/, '');
    return {
      sql,
      count,
      rows,
      resumo: `${count} linha(s) retornada(s) do SELECT.`,
    };
  },
  {
    name: 'executar_sql',
  description: `Executa SQL read-only no Supabase (APENAS SELECT ou WITH ... SELECT).
Use para agregações e buscas livres: COUNT, GROUP BY, DISTINCT, filtros complexos, CTE.
Proibido: INSERT, UPDATE, DELETE, DDL.
Exemplos:
- SELECT count(*) AS total FROM escola WHERE "statusGeral" = 'Conectada' AND fase LIKE '4.%'
- SELECT estado, count(*) AS qtd FROM escola GROUP BY estado ORDER BY qtd DESC LIMIT 30
Colunas camelCase precisam de aspas duplas (ex.: "statusGeral").`,
    schema: z.object({
    sql: z.string().min(1).describe('Query SELECT completa. Só leitura.'),
    maxRows: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(200)
      .describe('Limite de linhas retornadas (padrão 200, máx 500)'),
    }),
  },
);
