/**
 * Tema de dados dos gráficos — alinhado ao painel EACE Hub / OCE
 * (verde, azul, amarelo institucionais).
 */
export const EACE_COLORS = {
  /** Azul institucional — série primária */
  blue: '#009ADE',
  blueBright: '#6DCFF6',
  blueDeep: '#0066A6',
  blueSoft: '#9CB0BC',
  /** Verde institucional — segunda série / sucesso */
  green: '#00B451',
  greenDeep: '#00854A',
  greenSoft: '#A3CF62',
  /** Amarelo / laranja — destaque */
  yellow: '#FFE800',
  yellowSoft: '#FFF450',
  orange: '#FCAF17',
  /** Texto / eixos */
  slate: '#0D1A0F',
  gray: '#3A5040',
  mutedSoft: '#6E8875',
  ink: '#0D1A0F',
  /** Superfícies */
  grid: '#D8DED8',
  hairlineSoft: '#ECEEED',
  background: 'transparent',
  canvas: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceSoft: '#F5F7F5',
  onDark: '#FFFFFF',
  error: '#c64545',
  /** Séries semânticas do painel OCE */
  conectada: '#0066A6',
  naoConectada: '#9CB0BC',
  total: '#5A6E61',
  pesc: '#8A5326',
  pop: '#E8833A',
  pre: '#F2B705',
  pgs: '#FFD200',
  saldo: '#0E607C',
  forn: '#13627E',
} as const;

/** Sequência de séries / fatias — marca EACE */
export const EACE_PALETTE = [
  EACE_COLORS.blueDeep,
  EACE_COLORS.green,
  EACE_COLORS.orange,
  EACE_COLORS.blue,
  EACE_COLORS.greenDeep,
  EACE_COLORS.yellow,
  EACE_COLORS.forn,
  EACE_COLORS.greenSoft,
  EACE_COLORS.blueBright,
  EACE_COLORS.pop,
] as const;

/** Escala sequencial (heatmap) — do verde-claro ao azul-escuro */
export const EACE_HEAT_SCALE = [
  { from: -1e12, to: 0, color: EACE_COLORS.grid, name: '0' },
  { from: 0, to: 25, color: '#E8F5EC', name: 'baixo' },
  { from: 25, to: 50, color: EACE_COLORS.greenSoft, name: 'médio' },
  { from: 50, to: 75, color: EACE_COLORS.blue, name: 'alto' },
  { from: 75, to: 1e12, color: EACE_COLORS.blueDeep, name: 'muito alto' },
] as const;

export function eaceColor(index: number): string {
  return EACE_PALETTE[index % EACE_PALETTE.length];
}

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function formatTick(val: string | number): string {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return String(val);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  if (abs >= 1_000) return n.toLocaleString('pt-BR');
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/** Base visual compartilhada por todos os gráficos ApexCharts */
export function eaceApexBase(title?: string) {
  return {
    chart: {
      fontFamily: FONT,
      background: EACE_COLORS.background,
      foreColor: EACE_COLORS.gray,
      toolbar: { show: false },
      animations: { enabled: true, speed: 300 },
    },
    colors: [...EACE_PALETTE],
    title: title
      ? {
          text: title,
          align: 'left' as const,
          style: {
            fontSize: '13px',
            fontWeight: 700,
            color: EACE_COLORS.ink,
            fontFamily: FONT,
          },
        }
      : undefined,
    legend: {
      position: 'bottom' as const,
      fontSize: '11px',
      fontWeight: 600,
      fontFamily: FONT,
      labels: { colors: EACE_COLORS.gray },
      markers: { size: 7, offsetX: -2, offsetY: 0 },
      itemMargin: { horizontal: 10, vertical: 4 },
    },
    grid: {
      borderColor: EACE_COLORS.grid,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 6, right: 10, top: 6, bottom: 0 },
    },
    tooltip: {
      theme: 'light' as const,
      style: { fontSize: '12px', fontFamily: FONT },
      fillSeriesColor: false,
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '11px',
        fontWeight: 700,
        colors: [EACE_COLORS.slate],
        fontFamily: FONT,
      },
      background: {
        enabled: false,
      },
      dropShadow: { enabled: false },
    },
    xaxis: {
      labels: {
        style: {
          colors: EACE_COLORS.mutedSoft,
          fontSize: '11px',
          fontFamily: FONT,
          fontWeight: 500,
        },
        trim: true,
        hideOverlappingLabels: true,
      },
      axisBorder: { show: true, color: EACE_COLORS.grid },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      crosshairs: {
        show: true,
        stroke: { color: EACE_COLORS.grid, width: 1, dashArray: 0 },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: EACE_COLORS.mutedSoft,
          fontSize: '11px',
          fontFamily: FONT,
          fontWeight: 500,
        },
        formatter: (val: number) => formatTick(val),
      },
    },
    markers: {
      strokeColors: EACE_COLORS.canvas,
      strokeWidth: 2,
    },
    states: {
      hover: { filter: { type: 'none' as const } },
      active: { filter: { type: 'none' as const } },
    },
  };
}
