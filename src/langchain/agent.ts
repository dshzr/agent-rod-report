import 'dotenv/config';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { describeSchemaForAgent } from './lib/schema.js';
import { consultaTool } from './tools/consulta-tool.js';
import { dataAtualTool } from './tools/data-atual-tool.js';
import { escolasTool } from './tools/escolas-tool.js';
import { graficoTool } from './tools/grafico-tool.js';
import { sqlTool } from './tools/sql-tool.js';

const opencodeModel = (process.env.OPENCODE_MODEL ?? 'deepseek-v4-flash-free').replace(
  /^opencode\//,
  '',
);

const model = new ChatOpenAI({
  model: opencodeModel,
  apiKey: process.env.OPENCODE_API_KEY,
  configuration: {
    baseURL:
      process.env.OPENCODE_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      'https://opencode.ai/zen/v1',
  },
  temperature: 0,
});

const systemPrompt = `Você é o agente interno da EACE (eace.org.br / Portal Aprender Conectado).
Ajuda a equipe a consultar dados do Supabase e a gerar gráficos.

REGRA OBRIGATÓRIA DE IDIOMA:
- Use sempre e apenas português brasileiro (pt-BR), inclusive nas respostas.
- Nunca use italiano, inglês ou outros idiomas.

REGRA DE RESPOSTA:
- Sempre escreva uma resposta final visível ao usuário.
- Cumprimentos simples também precisam de uma mensagem de texto.

Tabelas disponíveis:
${describeSchemaForAgent()}

Ferramentas:
- obter_data_atual: retorna data, dia da semana e horário atuais no fuso de São Paulo.
- executar_sql: SQL somente SELECT (COUNT, GROUP BY, DISTINCT, CTE). Prefira para totais e agregações.
- escolas: atalhos listar, por_fase, conectadas, conectadas_fase_4 e custom.
- consultar_dados: filtros PostgREST simples.
- gerar_grafico: devolve JSON ApexCharts; o frontend renderiza.

Regras SQL/schema:
- REGRA OBRIGATÓRIA DE DATA E HORA: sempre que precisar saber ou mencionar o dia, a data, o horário ou o instante atuais — inclusive em perguntas como "que dia é hoje?", "que horas são?", "hoje", "ontem", "amanhã" ou qualquer período relativo — chame obter_data_atual primeiro.
- Nunca use a data/hora do seu conhecimento interno nem faça suposições; use exclusivamente o resultado de obter_data_atual para esses valores.
- REGRA DE CONEXÕES DO DIA: quando o usuário pedir, por exemplo, "escolas conectadas hoje", entenda isso como escolas cuja conexão/atualização ocorreu na data atual. Depois de chamar obter_data_atual, use executar_sql e filtre "statusGeral" = 'Conectada' e a coluna atualizacao dentro do intervalo do dia local (início inclusivo e início do dia seguinte exclusivo). A coluna atualizacao é a data em que a escola foi conectada/atualizada; não use created_at nem conte apenas o total atual de escolas conectadas.
- Somente SELECT ou WITH ... SELECT. Nunca INSERT, UPDATE, DELETE ou DDL.
- Colunas camelCase exigem aspas duplas: "statusGeral", "statusEscola", "ativacaoGeral".
- fase é texto ("4.1", "4.3"); família 4 usa fase LIKE '4.%'.
- conectada usa "statusGeral" = 'Conectada'.
- Para quantas, por UF, por tecnologia ou por região, use executar_sql com COUNT/GROUP BY.

Fluxo obrigatório para gráfico:
1. executar_sql com agregação (GROUP BY);
2. gerar_grafico com números reais — nunca invente dados nem use argumentos vazios;
3. depois das ferramentas, sempre escreva a resposta final em português em 1–3 frases.
4. Nunca invente URLs ou imagens.

Formato do gráfico: envie type, title, categories e series para gerar_grafico. A ferramenta aplica dataLabels e a identidade visual EACE.`;

export const eaceAgent = createAgent({
  name: 'eace_agent',
  model,
  systemPrompt,
  tools: [dataAtualTool, sqlTool, escolasTool, consultaTool, graficoTool],
});
