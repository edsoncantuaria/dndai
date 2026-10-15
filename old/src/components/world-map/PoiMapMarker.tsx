import { getPoiIconSpec, type PoiIconKind } from '@/lib/poiMapIcons';

type PoiMapMarkerProps = {
    x: number;
    y: number;
    kind: PoiIconKind;
    name: string;
    size?: number;
    discovered?: boolean;
    visited?: boolean;
    isCurrent?: boolean;
};

/** Marcador losango + glifo (referência: mapa estilo Skyrim). */
export function PoiMapMarker({
    x,
    y,
    kind,
    name,
    size = 14,
    discovered = true,
    visited = false,
    isCurrent = false,
}: PoiMapMarkerProps) {
    const spec = getPoiIconSpec(kind);
    const markerSize = isCurrent ? Math.max(size + 4, 16) : size;
    const scale = markerSize / 12;
    const opacity = discovered ? (visited ? 1 : 0.92) : 0.4;

    return (
        <g transform={`translate(${x}, ${y})`} opacity={opacity}>
            {/* Halo para contraste sobre arte ilustrada */}
            <circle r={markerSize + 5} fill="rgba(0,0,0,0.45)" />
            {isCurrent && (
                <circle r={markerSize + 8} fill="none" stroke="#fef08a" strokeWidth={2.5} opacity={0.9} />
            )}
            <path
                d={`M 0 ${-markerSize} L ${markerSize} 0 L 0 ${markerSize} L ${-markerSize} 0 Z`}
                fill={spec.gem}
                stroke={isCurrent ? '#fef08a' : spec.rim}
                strokeWidth={isCurrent ? 2.4 : 2}
            />
            <g transform={`scale(${scale * 0.55})`} stroke={spec.glyph} fill={spec.glyph} strokeWidth={0.6}>
                <path d={spec.path} transform="translate(-6,-6)" />
            </g>
            {visited && (
                <circle cx={markerSize - 2} cy={-markerSize + 2} r={3} fill="#22c55e" stroke="#052e16" strokeWidth={1} />
            )}
            {(visited || isCurrent) && (
                <text
                    x={0}
                    y={markerSize + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={isCurrent ? 700 : 500}
                    fill="#f8fafc"
                    stroke="#0f172a"
                    strokeWidth={3}
                    paintOrder="stroke"
                >
                    {name.length > 18 ? `${name.slice(0, 15)}…` : name}
                </text>
            )}
            <title>
                {name}
                {isCurrent ? ' (local atual)' : visited ? ' (visitado)' : ''}
            </title>
        </g>
    );
}

/** Miniatura para legenda HTML. */
export function PoiIconLegendSwatch({ kind, size = 10 }: { kind: PoiIconKind; size?: number }) {
    const spec = getPoiIconSpec(kind);
    const s = size;
    return (
        <svg width={size * 2} height={size * 2} viewBox={`${-s} ${-s} ${s * 2} ${s * 2}`} aria-hidden>
            <path
                d={`M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`}
                fill={spec.gem}
                stroke={spec.rim}
                strokeWidth={1.2}
            />
            <g transform={`scale(${s / 12 * 0.5})`} stroke={spec.glyph} fill={spec.glyph}>
                <path d={spec.path} transform="translate(-6,-6)" />
            </g>
        </svg>
    );
}
