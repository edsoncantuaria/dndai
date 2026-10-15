/** Preview usa contexto de jogo — não pré-renderizar no build Docker. */
export const dynamic = 'force-dynamic';

export default function UiPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
