'use client';

import { useEffect, useState } from 'react';

type Props = {
  content: string;
  /** Aberto enquanto o modelo ainda raciocina / streama */
  active?: boolean;
};

/**
 * Bloco "Pensando" no estilo Claude: colapsável, tipografia muted,
 * aberto durante o stream e recolhido quando a resposta chega.
 */
export function ThinkingBlock({ content, active = false }: Props) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
    else setOpen(false);
  }, [active]);

  if (!content.trim()) return null;

  return (
    <div className={`think ${active ? 'think--active' : ''}`}>
      <button
        type="button"
        className="think__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="think__chevron" aria-hidden>
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path
              fill="currentColor"
              d="M5.5 3.5 10 8l-4.5 4.5-.7-.7L8.6 8 4.8 4.2l.7-.7Z"
            />
          </svg>
        </span>
        <span className="think__label">
          {active ? 'Pensando' : 'Pensou'}
          {active && <span className="think__shimmer" aria-hidden />}
        </span>
      </button>

      {open && (
        <div className="think__body" aria-live={active ? 'polite' : undefined}>
          <div className="think__text">{content}</div>
        </div>
      )}
    </div>
  );
}
