'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <div className="chart-card__skeleton" aria-hidden />,
}) as unknown as React.ComponentType<{
  options: ApexOptions;
  series: ApexOptions['series'];
  type: string;
  height: number;
  width: string;
}>;

type Props = {
  title: string;
  apex: Record<string, unknown>;
};

const TYPE_LABELS: Record<string, string> = {
  bar: 'Barras',
  column: 'Colunas',
  line: 'Linha',
  area: 'Área',
  pie: 'Pizza',
  donut: 'Donut',
  radialBar: 'Radial',
  scatter: 'Dispersão',
  bubble: 'Bolhas',
  heatmap: 'Mapa de calor',
  treemap: 'Treemap',
  radar: 'Radar',
  polarArea: 'Área polar',
  rangeBar: 'Intervalo',
  boxPlot: 'Box plot',
  candlestick: 'Candlestick',
};

const CIRCULAR = new Set(['pie', 'donut', 'radialBar', 'polarArea']);

function chartHeight(
  type: string,
  expanded: boolean,
  horizontalCategoryCount = 0,
): number {
  if (horizontalCategoryCount > 8) {
    const grown = horizontalCategoryCount * 34;
    return expanded
      ? Math.min(Math.max(grown, 560), 900)
      : Math.min(Math.max(grown, 380), 640);
  }
  if (expanded) return CIRCULAR.has(type) ? 420 : 560;
  if (CIRCULAR.has(type)) return 320;
  if (type === 'radar' || type === 'treemap') return 340;
  return 380;
}

/** Categorias demais espremem barras/linhas em telas estreitas — melhor
 * rolar horizontalmente com largura mínima por categoria do que encolher tudo. */
function minPlotWidth(
  type: string,
  categoryCount: number,
  horizontal: boolean,
): number | undefined {
  if (CIRCULAR.has(type) || horizontal || categoryCount <= 7) return undefined;
  const perCategory = type === 'bar' ? 64 : 56;
  return categoryCount * perCategory;
}

const FALLBACK_COLORS = [
  '#0066A6',
  '#00B451',
  '#FCAF17',
  '#009ADE',
  '#00854A',
  '#FFE800',
  '#13627E',
  '#A3CF62',
];

const BAR_LIKE = new Set([
  'bar',
  'column',
  'rangeBar',
  'funnel',
  'pyramid',
  'heatmap',
  'treemap',
  'boxPlot',
  'candlestick',
]);

/** Overlay de chrome EACE Hub — não altera geometria/fill das séries. */
function eaceChrome(options: ApexOptions, type: string): ApexOptions {
  const isCircular = CIRCULAR.has(type);
  const isBarLike = BAR_LIKE.has(type);
  const isLineLike = type === 'line' || type === 'area';
  const hasCategoryAxis =
    options.xaxis?.type === 'category' ||
    (Array.isArray(options.xaxis?.categories) &&
      options.xaxis.categories.length > 0);
  const font =
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const colors =
    Array.isArray(options.colors) && options.colors.length > 0
      ? options.colors
      : FALLBACK_COLORS;

  const merged: ApexOptions = {
    ...options,
    chart: {
      ...(options.chart ?? {}),
      type: type as ApexOptions['chart'] extends { type?: infer T } ? T : never,
      background: 'transparent',
      fontFamily: font,
      foreColor: '#3A5040',
      toolbar: { show: false },
      animations: {
        enabled: true,
        speed: 300,
      },
      // Zoom em barras quebra o desenho inicial em Apex 6 — só linha/área
      zoom: isLineLike
        ? { enabled: true, type: 'x', autoScaleYaxis: true }
        : { enabled: false },
      selection: { enabled: false },
    },
    colors,
    title: { text: undefined },
    subtitle: { text: undefined },
    legend: {
      ...(options.legend ?? {}),
      fontSize: '11px',
      fontFamily: font,
      fontWeight: 600,
      labels: {
        ...(options.legend?.labels ?? {}),
        colors: '#3A5040',
      },
    },
    grid: {
      ...(options.grid ?? {}),
      borderColor: '#D8DED8',
      strokeDashArray: 0,
    },
    tooltip: {
      ...(options.tooltip ?? {}),
      theme: 'light',
      style: { fontSize: '12px', fontFamily: font },
    },
    dataLabels: {
      ...(options.dataLabels ?? {}),
      style: {
        ...(typeof options.dataLabels?.style === 'object'
          ? options.dataLabels.style
          : {}),
        fontFamily: font,
        fontWeight: 700,
      },
      dropShadow: { enabled: false },
    },
    xaxis: {
      ...(options.xaxis ?? {}),
      // O ApexCharts exige tickPlacement="on" para fazer zoom em eixos
      // categóricos. Sem isso, o arraste é exibido, mas não altera o domínio.
      tickPlacement:
        isLineLike && hasCategoryAxis
          ? 'on'
          : options.xaxis?.tickPlacement,
      labels: {
        ...(options.xaxis?.labels ?? {}),
        style: {
          ...(options.xaxis?.labels?.style ?? {}),
          colors: '#6E8875',
          fontSize: '11px',
          fontFamily: font,
        },
      },
      axisBorder: { show: true, color: '#D8DED8' },
      axisTicks: { show: false },
    },
    yaxis: Array.isArray(options.yaxis)
      ? options.yaxis
      : {
          ...(options.yaxis ?? {}),
          labels: {
            ...(options.yaxis &&
            !Array.isArray(options.yaxis) &&
            options.yaxis.labels
              ? options.yaxis.labels
              : {}),
            style: {
              colors: '#6E8875',
              fontSize: '11px',
              fontFamily: font,
            },
          },
        },
    states: {
      hover: { filter: { type: 'none' } },
      active: { filter: { type: 'none' } },
    },
  };

  // stroke.curve em bar/column zera a largura das barras no Apex 6
  if (isLineLike) {
    merged.stroke = {
      ...(options.stroke ?? {}),
      curve: options.stroke?.curve ?? 'smooth',
      width: options.stroke?.width ?? 2.5,
    };
  } else if (isBarLike || isCircular) {
    merged.stroke = {
      ...(options.stroke ?? {}),
      width: options.stroke?.width ?? (isCircular ? 2 : 0),
      colors: options.stroke?.colors,
    };
  }

  // Preserva plotOptions do servidor; só reforça raio em barras
  if (isBarLike && type !== 'heatmap' && type !== 'treemap') {
    merged.plotOptions = {
      ...(options.plotOptions ?? {}),
      bar: {
        ...(options.plotOptions?.bar ?? {}),
        borderRadius: options.plotOptions?.bar?.borderRadius ?? 4,
      },
    };
  }

  return merged;
}

export function ApexChartView({ title, apex }: Props) {
  const reactId = useId();
  const chartDomId = `chart-${reactId.replace(/:/g, '')}`;
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const options = apex as ApexOptions;
  const series = (options.series ?? []) as ApexOptions['series'];
  const chartType = String(options.chart?.type ?? 'bar');
  const type = chartType === 'column' ? 'bar' : chartType;
  const typeLabel = TYPE_LABELS[chartType] ?? TYPE_LABELS[type] ?? 'Gráfico';

  const merged = useMemo(() => eaceChrome(options, type), [options, type]);

  const horizontal = Boolean(
    (merged.plotOptions as { bar?: { horizontal?: boolean } } | undefined)?.bar
      ?.horizontal,
  );
  const categoryCount = Array.isArray(merged.xaxis?.categories)
    ? merged.xaxis.categories.length
    : 0;
  const height = chartHeight(
    type,
    expanded,
    horizontal ? categoryCount : 0,
  );
  const minWidth = minPlotWidth(type, categoryCount, horizontal);
  const chartOptions = useMemo(
    () => ({
      ...merged,
      chart: {
        ...merged.chart,
        id: chartDomId,
      },
    }),
    [chartDomId, merged],
  );

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const downloadPng = useCallback(async () => {
    setBusy(true);
    try {
      const ApexCharts = (await import('apexcharts')).default;
      const uri = (await ApexCharts.exec(chartDomId, 'dataURI')) as {
        imgURI?: string;
      };
      if (!uri?.imgURI) return;
      const a = document.createElement('a');
      const safe = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
      a.href = uri.imgURI;
      a.download = `${safe || 'grafico-eace'}.png`;
      a.click();
    } catch {
      // chart ainda não montou
    } finally {
      setBusy(false);
    }
  }, [chartDomId, title]);

  const resetZoom = useCallback(async () => {
    try {
      const ApexCharts = (await import('apexcharts')).default;
      await ApexCharts.exec(chartDomId, 'resetSeries', true, true);
    } catch {
      // chart ainda não montou
    }
  }, [chartDomId]);

  return (
    <>
      {expanded && (
        <div
          className="chart-card__lightbox"
          role="presentation"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={`chart-card ${expanded ? 'chart-card--expanded' : ''}`}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? title : undefined}
      >
        <header className="chart-card__header">
          <div className="chart-card__heading">
            <p className="chart-card__eyebrow">
              <span className="chart-card__dot" aria-hidden />
              {typeLabel}
            </p>
            <h3 className="chart-card__title">{title}</h3>
          </div>
          <div className="chart-card__actions">
            <button
              type="button"
              className="chart-card__btn"
              onClick={() => void downloadPng()}
              disabled={busy}
              aria-label="Baixar PNG"
              title="Baixar PNG"
            >
              {busy ? (
                <span className="chart-card__spinner" aria-hidden />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 3.5v11M7.75 10.5 12 14.75l4.25-4.25M5 19.5h14" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="chart-card__btn chart-card__btn--primary"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Recolher gráfico' : 'Ampliar gráfico'}
              aria-pressed={expanded}
              title={expanded ? 'Recolher' : 'Ampliar'}
            >
              {expanded ? (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M15 3h6v6M9 21H3v-6M14 10l7-7M3 21l7-7" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <div
          className="chart-card__canvas"
          onDoubleClick={
            type === 'line' || type === 'area'
              ? () => void resetZoom()
              : undefined
          }
        >
          <div style={minWidth ? { minWidth } : undefined}>
            <ReactApexChart
              options={chartOptions}
              series={series}
              type={type}
              height={height}
              width="100%"
            />
          </div>
        </div>

        {(type === 'line' || type === 'area') && (
          <p className="chart-card__hint">
            Arraste no eixo para ampliar · duplo clique para resetar
          </p>
        )}
      </div>
    </>
  );
}
