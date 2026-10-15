/** Marcador “você está aqui” — alto contraste sobre mapa ilustrado. */
export function PlayerMapMarker({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  const shortLabel = label.length > 22 ? `${label.slice(0, 19)}…` : label;

  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <circle r={22} fill="rgba(0,0,0,0.35)" />
      <circle r={18} fill="none" stroke="#fef08a" strokeWidth={2.5} opacity={0.95} />
      <circle r={11} fill="#facc15" stroke="#78350f" strokeWidth={2.5} />
      <circle r={4} fill="#fffbeb" opacity={0.95} />
      <rect
        x={-56}
        y={20}
        width={112}
        height={22}
        rx={6}
        fill="rgba(15,23,42,0.88)"
        stroke="#facc15"
        strokeWidth={1.2}
      />
      <text
        x={0}
        y={35}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#fef9c3"
      >
        {shortLabel}
      </text>
      <title>{label} (posição atual)</title>
    </g>
  );
}
