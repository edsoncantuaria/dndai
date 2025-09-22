import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'App em branco',
  description: 'Um app Next.js em branco.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
