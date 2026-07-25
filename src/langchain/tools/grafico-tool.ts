import { tool } from 'langchain';
import { z } from 'zod';
import {
  EACE_COLORS,
  EACE_HEAT_SCALE,
  EACE_PALETTE,
  eaceApexBase,
  eaceColor,
} from '../lib/eace-theme.js';

const CHART_TYPES = [
  'line',
  'area',
  'bar',
  'column',
  'pie',
  'donut',
  'radialBar',
  'radar',
  'polarArea',
  'scatter',
  'bubble',
  'heatmap',
  'treemap',
  'rangeBar',
  'rangeArea',
  'boxPlot',
  'candlestick',
  'funnel',
  'pyramid',
] as const;

const pointSchema = z.union([
  z.number(),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number()]),
  z.object({
    x: z.union([z.string(), z.number()]),
    y: z.union([z.number(), z.array(z.number())]),
    z: z.number().optional(),
  }),
]);

const seriesSchema = z.object({
  name: z.string().optional().describe('Nome da série'),
  data: z.array(pointSchema).min(1).describe('Valores / pontos da série'),
  color: z.string().optional(),
  type: z.enum(['line', 'area', 'bar', 'column', 'scatter']).optional()
    .describe('Para gráficos mistos (combo)'),
});

const apexInputSchema = z.object({
  type: z.enum(CHART_TYPES).describe('Tipo ApexCharts'),
  title: z.string().optional(),
  categories: z
    .array(z.string())
    .optional()
    .describe('Eixo X / labels (pie, donut, polarArea, radialBar, radar, bar, line…)'),
  series: z
    .array(seriesSchema)
    .min(1)
    .describe('Séries. Pie/donut/polarArea/radialBar: uma série com data = valores.'),
  stacked: z.boolean().optional(),
  horizontal: z.boolean().optional().describe('Barras horizontais (bar)'),
  distributed: z
    .boolean()
    .optional()
    .describe('Cada barra/célula com cor da paleta EACE'),
});

export type ApexChartInput = z.infer<typeof apexInputSchema>;

function isCircular(type: ApexChartInput['type']) {
  return (
    type === 'pie' ||
    type === 'donut' ||
    type === 'polarArea' ||
    type === 'radialBar'
  );
}

function toNumbers(data: z.infer<typeof pointSchema>[]): number[] {
  return data.map((p) => {
    if (typeof p === 'number') return p;
    if (Array.isArray(p)) return p[1] ?? p[0];
    if (Array.isArray(p.y)) return p.y[0] ?? 0;
    return Number(p.y);
  });
}

function buildSeries(input: ApexChartInput) {
  return input.series.map((s, i) => ({
    name: s.name ?? `Série ${i + 1}`,
    data: s.data,
    ...(s.type ? { type: s.type === 'column' ? 'bar' : s.type } : {}),
  }));
}

export function toApexConfig(input: ApexChartInput) {
  const base = eaceApexBase(input.title);
  const type = input.type === 'column' ? 'bar' : input.type;
  const colors = input.series.map((s, i) => s.color ?? eaceColor(i));

  if (isCircular(input.type)) {
    const labels =
      input.categories ??
      input.series.map((s, i) => s.name ?? `Item ${i + 1}`);
    const values =
      input.series.length === 1
        ? toNumbers(input.series[0].data)
        : input.series.map((s) => toNumbers(s.data)[0] ?? 0);

    const sliceColors = values.map((_, i) => eaceColor(i));

    const circular: Record<string, unknown> = {
      ...base,
      chart: {
        ...base.chart,
        type: input.type,
      },
      series: values,
      labels,
      colors: sliceColors,
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '12px',
          fontWeight: 500,
          colors: [EACE_COLORS.onDark],
          fontFamily: 'Inter, sans-serif',
        },
        dropShadow: { enabled: false },
      },
      stroke: { width: 2, colors: [EACE_COLORS.canvas] },
      legend: { ...base.legend, position: 'bottom' },
    };

    if (input.type === 'donut') {
      circular.plotOptions = {
        pie: {
          donut: {
            size: '64%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '12px',
                fontWeight: 500,
                color: EACE_COLORS.gray,
              },
              value: {
                show: true,
                fontSize: '22px',
                fontWeight: 800,
                color: EACE_COLORS.ink,
                formatter: (v: string) =>
                  Number(v).toLocaleString('pt-BR'),
              },
              total: {
                show: true,
                label: 'Total',
                fontSize: '12px',
                fontWeight: 600,
                color: EACE_COLORS.gray,
                formatter: (w: {
                  globals: { seriesTotals: number[] };
                }) =>
                  w.globals.seriesTotals
                    .reduce((a, b) => a + b, 0)
                    .toLocaleString('pt-BR'),
              },
            },
          },
        },
      };
    }

    if (input.type === 'radialBar') {
      circular.plotOptions = {
        radialBar: {
          hollow: { size: '52%' },
          track: {
            background: EACE_COLORS.surfaceSoft,
            strokeWidth: '97%',
          },
          dataLabels: {
            name: { fontSize: '12px', fontWeight: 500, color: EACE_COLORS.gray },
            value: {
              fontSize: '22px',
              fontWeight: 500,
              color: EACE_COLORS.ink,
            },
            total: {
              show: true,
              label: 'Total',
              color: EACE_COLORS.gray,
            },
          },
        },
      };
      circular.stroke = { lineCap: 'round' };
      circular.dataLabels = { enabled: false };
    }

    if (input.type === 'polarArea') {
      circular.stroke = { colors: [EACE_COLORS.canvas], width: 2 };
      circular.fill = { opacity: 0.88 };
      circular.plotOptions = {
        polarArea: {
          rings: { strokeWidth: 1, strokeColor: EACE_COLORS.grid },
        },
      };
    }

    return circular;
  }

  const chartType = type;
  const categories = input.categories;
  const series = buildSeries(input);

  // Tipos que tipicamente usam categories + number[]
  const categoryTypes = new Set([
    'line',
    'area',
    'bar',
    'radar',
    'heatmap',
    'rangeArea',
    'funnel',
    'pyramid',
  ]);

  if (categoryTypes.has(chartType) && chartType !== 'heatmap') {
    if (!categories?.length && chartType !== 'treemap') {
      // funnel/pyramid/radar/bar/line/area precisam de categories (exceto se data for {x,y})
      const first = input.series[0]?.data[0];
      const hasXY = typeof first === 'object' && first !== null && !Array.isArray(first) && 'x' in first;
      if (!hasXY && chartType !== 'funnel' && chartType !== 'pyramid') {
        throw new Error(`categories é obrigatório para type=${input.type}`);
      }
    }
  }

  const config: Record<string, unknown> = {
    ...base,
    chart: {
      ...base.chart,
      type: chartType === 'funnel' || chartType === 'pyramid' ? 'bar' : chartType,
      stacked: Boolean(input.stacked),
    },
    colors,
    series:
      chartType === 'funnel' || chartType === 'pyramid'
        ? [
            {
              name: input.series[0]?.name ?? 'Valor',
              data: toNumbers(input.series[0].data),
            },
          ]
        : series.map((s) => ({
            name: s.name,
            data: s.data,
            ...(s.type ? { type: s.type } : {}),
          })),
    xaxis: {
      ...base.xaxis,
      ...(categories?.length ? { categories } : {}),
    },
  };

  if (chartType === 'bar' || input.type === 'column') {
    const horizontal =
      input.type === 'bar' ? Boolean(input.horizontal) : false;
    config.plotOptions = {
      bar: {
        horizontal,
        borderRadius: 4,
        columnWidth: '55%',
        barHeight: '70%',
        distributed: Boolean(input.distributed),
        dataLabels: { position: horizontal ? 'center' : 'top' },
      },
    };
    if (input.distributed) {
      config.colors = [...EACE_PALETTE];
      config.legend = { show: false };
    }
    config.stroke = { show: true, width: 0, colors: ['transparent'] };
    if (!horizontal) {
      config.grid = {
        ...(typeof base.grid === 'object' ? base.grid : {}),
        padding: { top: 28, right: 10, bottom: 0, left: 6 },
      };
    }
    config.dataLabels = {
      ...base.dataLabels,
      enabled: true,
      offsetY: horizontal ? 0 : -18,
      offsetX: horizontal ? 6 : 0,
      style: {
        fontSize: '11px',
        fontWeight: 500,
        colors: horizontal ? [EACE_COLORS.onDark] : [EACE_COLORS.slate],
        fontFamily: 'Inter, sans-serif',
      },
      background: { enabled: false },
      formatter: (val: number) =>
        typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val),
    };
  }

  if (chartType === 'line') {
    config.stroke = {
      curve: 'smooth',
      width: 2.5,
      colors,
    };
    config.markers = {
      size: 4,
      colors,
      strokeColors: EACE_COLORS.canvas,
      strokeWidth: 2,
      hover: { size: 6 },
    };
    config.dataLabels = {
      ...base.dataLabels,
      enabled: false,
    };
  }

  if (chartType === 'area') {
    config.stroke = { curve: 'smooth', width: 2.5, colors };
    config.fill = {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.35,
        opacityFrom: 0.42,
        opacityTo: 0.04,
        stops: [0, 90, 100],
      },
    };
    config.markers = {
      size: 0,
      hover: { size: 5 },
      strokeColors: EACE_COLORS.canvas,
    };
    config.dataLabels = {
      ...base.dataLabels,
      enabled: false,
    };
  }

  if (chartType === 'radar') {
    config.stroke = { width: 2 };
    config.fill = { opacity: 0.22 };
    config.markers = { size: 4, strokeColors: EACE_COLORS.canvas, strokeWidth: 2 };
    config.yaxis = { show: false };
    config.plotOptions = {
      radar: {
        polygons: {
          strokeColors: EACE_COLORS.grid,
          connectorColors: EACE_COLORS.grid,
          fill: {
            colors: [EACE_COLORS.canvas, EACE_COLORS.surfaceSoft],
          },
        },
      },
    };
  }

  if (chartType === 'heatmap') {
    config.plotOptions = {
      heatmap: {
        shadeIntensity: 0.4,
        radius: 5,
        colorScale: {
          ranges: [...EACE_HEAT_SCALE],
        },
      },
    };
    config.dataLabels = {
      enabled: true,
      style: {
        colors: [EACE_COLORS.ink],
        fontSize: '10px',
        fontWeight: 500,
      },
    };
  }

  if (chartType === 'treemap') {
    config.plotOptions = {
      treemap: {
        distributed: true,
        enableShades: true,
        borderRadius: 5,
      },
    };
    config.dataLabels = {
      enabled: true,
      style: {
        fontSize: '12px',
        fontWeight: 500,
        colors: [EACE_COLORS.onDark],
      },
    };
    config.legend = { show: false };
  }

  if (chartType === 'scatter' || chartType === 'bubble') {
    // Atalho: categories + números → pontos {x,y,z} (útil p/ "bubble por região")
    if (categories?.length) {
      const labels = [...categories];
      config.series = input.series.map((s, si) => {
        const nums = toNumbers(s.data);
        return {
          name: s.name ?? `Série ${si + 1}`,
          data: labels.map((_, i) => ({
            x: i + 1,
            y: nums[i] ?? 0,
            z: Math.max(nums[i] ?? 1, 1),
          })),
        };
      });
      config.xaxis = {
        ...base.xaxis,
        type: 'numeric',
        tickAmount: labels.length,
        labels: {
          formatter: (val: string) => {
            const i = Math.round(Number(val)) - 1;
            return labels[i] ?? val;
          },
        },
      };
      config.dataLabels = {
        enabled: chartType !== 'bubble',
        formatter: (val: number, opts: { dataPointIndex?: number }) => {
          const label = labels[opts.dataPointIndex ?? 0] ?? '';
          const n =
            typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val);
          return label ? `${label}: ${n}` : n;
        },
        style: {
          fontSize: '10px',
          fontWeight: 500,
          colors: [EACE_COLORS.slate],
        },
        background: { enabled: false },
      };
    } else {
      config.xaxis = {
        ...base.xaxis,
        tickAmount: 8,
        type: 'numeric',
      };
    }
    config.markers = {
      size: chartType === 'bubble' ? undefined : 6,
      strokeColors: EACE_COLORS.canvas,
      strokeWidth: 2,
    };
  }

  if (chartType === 'rangeBar') {
    config.plotOptions = {
      bar: { horizontal: true, borderRadius: 6, barHeight: '70%' },
    };
  }

  if (chartType === 'rangeArea') {
    config.stroke = { curve: 'smooth', width: 2 };
    config.fill = { opacity: 0.35 };
  }

  if (chartType === 'boxPlot') {
    config.plotOptions = {
      boxPlot: {
        colors: {
          upper: EACE_COLORS.blue,
          lower: EACE_COLORS.green,
        },
      },
    };
  }

  if (chartType === 'candlestick') {
    config.plotOptions = {
      candlestick: {
        colors: {
          upward: EACE_COLORS.green,
          downward: EACE_COLORS.error,
        },
        wick: { useFillColor: true },
      },
    };
  }

  if (input.type === 'funnel' || input.type === 'pyramid') {
    const cats = categories ?? input.series[0].data.map((_, i) => `Etapa ${i + 1}`);
    config.chart = { ...base.chart, type: 'bar' };
    config.plotOptions = {
      bar: {
        borderRadius: 4,
        horizontal: true,
        barHeight: '78%',
        isFunnel: true,
        isFunnel3d: false,
      },
    };
    config.xaxis = { ...base.xaxis, categories: cats };
    config.colors = [EACE_COLORS.blue];
    config.fill = {
      type: 'gradient',
      gradient: {
        type: 'horizontal',
        colorStops: [
          { offset: 0, color: EACE_COLORS.blue, opacity: 1 },
          { offset: 100, color: EACE_COLORS.yellow, opacity: 1 },
        ],
      },
    };
    config.dataLabels = {
      enabled: true,
      dropShadow: { enabled: false },
      style: {
        colors: [EACE_COLORS.onDark],
        fontWeight: 500,
        fontSize: '12px',
      },
    };
    config.legend = { show: false };
    if (input.type === 'pyramid') {
      // pyramid: inverter ordem visual
      const data = toNumbers(input.series[0].data).slice().reverse();
      const labels = cats.slice().reverse();
      config.series = [{ name: input.series[0]?.name ?? 'Valor', data }];
      config.xaxis = { ...base.xaxis, categories: labels };
    }
  }

  // Linha/área: labels no tooltip. Demais: valores no plot.
  const quietLabels = chartType === 'line' || chartType === 'area';
  if (!quietLabels) {
    const current =
      config.dataLabels && typeof config.dataLabels === 'object'
        ? (config.dataLabels as Record<string, unknown>)
        : {};
    config.dataLabels = { ...base.dataLabels, ...current, enabled: true };
  }

  return config;
}

/**
 * Monta options ApexCharts (JSON) para o frontend Next renderizar.
 * Não gera imagem — o app consome `apex` e desenha na tela.
 */
export const graficoTool = tool(
  async (inputData) => {
    const apex = toApexConfig(inputData);
    return {
      kind: 'apex-chart' as const,
      title: inputData.title ?? 'Gráfico',
      apex,
    };
  },
  {
  name: 'gerar_grafico',
  description: `Monta JSON de options ApexCharts (paleta coral/teal/amber no canvas cream) para o frontend renderizar.
NÃO gera imagem. A UI Next.js usa o campo "apex" com react-apexcharts.
Barras/fatias mostram dataLabels; linha/área priorizam tooltip limpo.
Tipos: ${CHART_TYPES.join(', ')}.
Prefira agregar com executar-sql (GROUP BY) antes.
Formato comum (bar/column/line/area/radar):
{ "type":"column", "title":"...", "categories":["MA","PA"], "series":[{"name":"Conectadas","data":[10,20]}] }
Pie/donut/polarArea/radialBar: categories=labels; series[0].data=valores.
Treemap: series[{ data:[{x:"Fibra",y:100},{x:"Satélite",y:40}] }]
Bubble por região (atalho): categories=["Norte","Sul"], series=[{name:"Escolas",data:[100,80]}]
Bubble livre: series[{ data:[{x:1,y:1000,z:30}] }] — x,y,z numéricos.`,

    schema: apexInputSchema,
  },
);
