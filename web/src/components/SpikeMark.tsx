/** Anthropic-style 4-spoke radial spike mark (brand glyph substitute). */
export function SpikeMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1.2 13.15 9.4 20.8 6.2 14.6 12l6.2 5.8-7.65-3.2L12 22.8l-1.15-8.2L3.2 17.8 9.4 12 3.2 6.2l7.65 3.2L12 1.2Z" />
    </svg>
  );
}
