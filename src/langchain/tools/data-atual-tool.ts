import { tool } from 'langchain';
import { z } from 'zod';

const TIME_ZONE = 'America/Sao_Paulo';

export function getCurrentDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const diaSemana = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    weekday: 'long',
  }).format(now);

  return {
    data_iso: `${values.year}-${values.month}-${values.day}`,
    data_formatada: `${values.day}/${values.month}/${values.year}`,
    dia_da_semana: diaSemana,
    horario: `${values.hour}:${values.minute}:${values.second}`,
    fuso_horario: TIME_ZONE,
    instante_utc: now.toISOString(),
  };
}

export const dataAtualTool = tool(
  async () => getCurrentDate(),
  {
    name: 'obter_data_atual',
    description:
      'Fonte oficial de data e hora atuais do agente no fuso de São Paulo. Deve ser chamada sempre que a resposta precisar saber ou mencionar o dia, a data, o horário ou o instante atuais, inclusive hoje, ontem, amanhã e períodos relativos.',
    schema: z.object({}),
  },
);
