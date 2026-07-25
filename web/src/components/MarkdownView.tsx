'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  content: string;
};

/** Remove markdown de imagem — gráficos vêm pelo ApexCharts. */
function cleanContent(content: string) {
  return content
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function MarkdownView({ content }: Props) {
  const text = cleanContent(content);
  if (!text) return null;

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="md__table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
