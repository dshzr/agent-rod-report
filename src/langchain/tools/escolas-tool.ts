import { tool } from 'langchain';
import { z } from 'zod';
import { ESCOLA_SCHEMA } from '../lib/schema.js';
import { supabaseQuery, type QueryFilter } from '../lib/supabase.js';

const filterSchema = z.object({
  column: z.string(),
  op: z
    .enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'])
    .default('eq'),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

function faseFilter(fase: string): QueryFilter {
  if (/^\d+$/.test(fase)) {
    return { column: 'fase', op: 'like', value: `${fase}.*` };
  }
  return { column: 'fase', op: 'eq', value: fase };
}

async function queryEscolas(options: {
  filters?: QueryFilter[];
  select?: string;
  order?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const rows = await supabaseQuery(ESCOLA_SCHEMA.table, {
    select: options.select,
    filters: options.filters,
    order: options.order ?? 'nome.asc',
    limit,
  });

  return {
    table: ESCOLA_SCHEMA.table,
    count: rows.length,
    description: ESCOLA_SCHEMA.description,
    rows,
    resumo: `${rows.length} registro(s) em "${ESCOLA_SCHEMA.table}".`,
  };
}

export const escolasTool = tool(
  async (input) => {
    const limit = input.limit ?? 50;

    switch (input.action) {
      case 'por_fase': {
        if (input.fase === undefined) {
          throw new Error('Informe fase para action=por_fase');
        }
        return queryEscolas({ filters: [faseFilter(String(input.fase).trim())], limit });
      }
      case 'conectadas': {
        const filters: QueryFilter[] = [{ column: 'statusGeral', op: 'eq', value: 'Conectada' }];
        if (input.fase !== undefined && `${input.fase}`.trim() !== '') {
          filters.push(faseFilter(String(input.fase).trim()));
        }
        return queryEscolas({ filters, limit });
      }
      case 'conectadas_fase_4':
        return queryEscolas({
          filters: [
            { column: 'statusGeral', op: 'eq', value: 'Conectada' },
            faseFilter('4'),
          ],
          limit,
        });
      case 'custom':
        return queryEscolas({
          select: input.select,
          filters: input.filters as QueryFilter[] | undefined,
          order: input.order,
          limit,
        });
      case 'listar':
      default:
        return queryEscolas({
          select: input.select,
          filters: input.filters as QueryFilter[] | undefined,
          order: input.order,
          limit,
        });
    }
  },
  {
    name: 'escolas',
  description:
    'Consulta escolas da EACE com ações: listar, por_fase, conectadas, conectadas_fase_4 ou custom. Para totais/GROUP BY prefira executar-sql.',
    schema: z.object({
    action: z
      .enum(['listar', 'por_fase', 'conectadas', 'conectadas_fase_4', 'custom'])
      .describe('Ação de negócio'),
    fase: z
      .union([z.string(), z.number()])
      .optional()
      .describe('Fase (ex.: "4" ou "4.1"). Obrigatório em por_fase'),
    select: z.string().optional(),
    filters: z.array(filterSchema).optional(),
    order: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional().default(50),
    }),
  },
);
