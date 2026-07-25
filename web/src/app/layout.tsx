import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EACE Agent',
  description: 'Chat com o agente EACE e gráficos ApexCharts dinâmicos',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full"
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
