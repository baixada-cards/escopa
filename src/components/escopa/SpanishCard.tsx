import './SpanishCard.css'

export type Suit = 'espadas' | 'bastos' | 'copas' | 'oros'
export type CardSize = 'sm' | 'md' | 'lg'

type GlyphProps = {
  size?: number
  color: string
}

function OrosGlyph({ size = 24, color }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>
      <circle cx="12" cy="12" r="10" fill={color} />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="var(--card-0)" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="2" fill="var(--card-0)" />
    </svg>
  )
}

function CopasGlyph({ size = 24, color }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>
      <path
        d="M 5 3 L 19 3 L 19 5 C 19 10 16 13 13 13.5 L 13 19 L 17 19 L 17 21 L 7 21 L 7 19 L 11 19 L 11 13.5 C 8 13 5 10 5 5 Z"
        fill={color}
      />
    </svg>
  )
}

function EspadasGlyph({ size = 24, color }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>
      <path d="M 11 2 L 13 2 L 13 15 L 11 15 Z" fill={color} />
      <path d="M 11 2 L 12 0.5 L 13 2 Z" fill={color} />
      <rect x="6" y="15" width="12" height="1.8" fill={color} />
      <rect x="11.3" y="16.8" width="1.4" height="3.5" fill={color} />
      <circle cx="12" cy="21.2" r="1.4" fill={color} />
    </svg>
  )
}

function BastosGlyph({ size = 24, color }: GlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>
      <path
        d="M 9 2 Q 6 4 7 8 L 10 18 Q 10.5 21 12 21.5 Q 13.5 21 14 18 L 17 8 Q 18 4 15 2 Q 12 3.5 9 2 Z"
        fill={color}
      />
      <circle cx="10" cy="9" r="0.9" fill="var(--card-0)" opacity="0.5" />
      <circle cx="14" cy="13" r="0.9" fill="var(--card-0)" opacity="0.5" />
      <circle cx="11" cy="16" r="0.7" fill="var(--card-0)" opacity="0.5" />
    </svg>
  )
}

type GlyphComponent = (props: GlyphProps) => React.ReactElement

const SUITS: Record<Suit, { Glyph: GlyphComponent; color: string }> = {
  oros: { Glyph: OrosGlyph, color: 'var(--suit-ochre)' },
  copas: { Glyph: CopasGlyph, color: 'var(--suit-red)' },
  espadas: { Glyph: EspadasGlyph, color: 'var(--suit-black)' },
  bastos: { Glyph: BastosGlyph, color: 'var(--suit-green)' },
}

const RANK_LABEL: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  10: 'S',
  11: 'C',
  12: 'R',
}

const RANK_FULL: Record<number, string> = {
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey',
}

const DIMS: Record<
  CardSize,
  { width: number; height: number; rank: number; cornerGlyph: number; centerGlyph: number }
> = {
  sm: { width: 52, height: 78, rank: 18, cornerGlyph: 10, centerGlyph: 30 },
  md: { width: 84, height: 128, rank: 28, cornerGlyph: 14, centerGlyph: 50 },
  lg: { width: 120, height: 180, rank: 42, cornerGlyph: 20, centerGlyph: 72 },
}

type SpanishCardProps = {
  rank: number
  suit: Suit
  size?: CardSize
  faceDown?: boolean
  className?: string
  style?: React.CSSProperties
}

export function SpanishCard({
  rank,
  suit,
  size = 'md',
  faceDown = false,
  className = '',
  style,
}: SpanishCardProps) {
  const dimensions = DIMS[size]
  const cardStyle = {
    width: dimensions.width,
    height: dimensions.height,
    ...style,
  }

  if (faceDown) {
    return (
      <div className={`spcard-back ${className}`} style={cardStyle} aria-hidden="true">
        <div className="spcard-back-pattern" />
      </div>
    )
  }

  const { Glyph, color } = SUITS[suit]
  const isFace = rank >= 10
  const rankLabel = RANK_LABEL[rank] ?? String(rank)

  return (
    <div className={`spcard ${className}`} style={cardStyle}>
      <div className="spcard-inner">
        <div className="spcard-corner spcard-corner-tl" style={{ color }}>
          <div style={{ fontSize: dimensions.rank * 0.6 }}>{rankLabel}</div>
          <Glyph size={dimensions.cornerGlyph} color={color} />
        </div>

        <div className="spcard-center">
          {isFace ? (
            <div className="spcard-face">
              <div className="spcard-face-letter" style={{ color, fontSize: dimensions.centerGlyph * 0.95 }}>
                {rankLabel}
              </div>
              <div className="spcard-face-label">{RANK_FULL[rank]}</div>
              <Glyph size={dimensions.cornerGlyph * 1.4} color={color} />
            </div>
          ) : (
            <div className="spcard-pip">
              <div className="spcard-pip-num" style={{ color, fontSize: dimensions.rank * 1.2 }}>
                {rankLabel}
              </div>
              <Glyph size={dimensions.centerGlyph} color={color} />
            </div>
          )}
        </div>

        <div className="spcard-corner spcard-corner-br" style={{ color }}>
          <div style={{ fontSize: dimensions.rank * 0.6 }}>{rankLabel}</div>
          <Glyph size={dimensions.cornerGlyph} color={color} />
        </div>
      </div>
    </div>
  )
}
