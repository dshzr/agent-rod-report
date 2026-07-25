import { tool } from 'langchain';
import { z } from 'zod';
import { ALLOWED_TABLES, ESCOLA_SCHEMA, type AllowedTable } from '../lib/schema.js';
import { supabaseQuery, type QueryFilter } from '../lib/supabase.js';

const filterSchema = z.object({
  column: z.string(),
  op: z
    .enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'])
    .default('eq'),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const consultaTool = tool(
  async (input) => {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
    const rows = await supabaseQuery(input.table, {
      select: input.select,
      filters: input.filters as QueryFilter[] | undefined,
      order: input.order,
      limit,
    });

    return {
      table: input.table,
      count: rows.length,
      description: ESCOLA_SCHEMA.description,
      rows,
      resumo: `${rows.length} registro(s) em "${input.table}".`,
    };
  },
  {
    name: 'consultar_dados',
  description: `Consulta genérica PostgREST às tabelas liberadas: ${ALLOWED_TABLES.join(', ')}. Prefira executar-sql para agregações.`,
    schema: z.object({
    table: z.enum(ALLOWED_TABLES as unknown as [AllowedTable, ...AllowedTable[]]),
    select: z.string().default('*'),
    filters: z.array(filterSchema).optional(),
    order: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(50),
    }),
  },
);
