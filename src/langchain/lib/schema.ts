/**
 * Schema conhecido das tabelas (contexto para o agent).
 * Não é MVC — só documentação estruturada usada nas instructions.
 */
export const ESCOLA_SCHEMA = {
  table: 'escola',
  description:
    'Escolas do programa EACE / Portal Aprender Conectado. Filtre por fase, status (statusGeral/statusEscola/redes), estado, município, INEP, tecnologia, fornecedores, etc.',
  columns: [
    'id',
    'created_at',
    'nome',
    'inep',
    'fase',
    'tecnologia',
    'regional',
    'estado',
    'municipio',
    'regiao',
    'localizacao',
    'dependencia_escolar',
    'matriculas',
    'endereco_escola',
    'latitude',
    'longitude',
    'velocidade_contratada',
    'statusEscola',
    'statusGerador',
    'statusGeral',
    'statusRedeExterna',
    'statusRedeInterna',
    'ativacaoGeral',
    'ativacaoRedeExterna',
    'ativacaoRedeInterna',
    'ativacaoRedeEletrica',
    'atualizacao',
    'fornecedor_ri',
    'fornecedor_re',
    'dataMigracao',
    'satelitalMigrado',
    'migracaoLpu',
    'recebidoTelebras',
    'recebidoTelebrasPor',
    'tecnologiaMigrada',
    'passivel_migracao',
  ],
} as const;

export const ALLOWED_TABLES = [ESCOLA_SCHEMA.table] as const;
export type AllowedTable = (typeof ALLOWED_TABLES)[number];

export function describeSchemaForAgent(): string {
  return `- ${ESCOLA_SCHEMA.table}: ${ESCOLA_SCHEMA.description}
  Colunas: ${ESCOLA_SCHEMA.columns.join(', ')}`;
}
