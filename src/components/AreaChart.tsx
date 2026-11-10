import { formatMonth } from '../lib/format'

export interface ChartPoint {
  date: string
  value: number
  /** Optional reference line drawn dashed under the curve (amount invested). */
  baseline?: number
}

interface AreaChartProps {
  points: readonly ChartPoint[]
  /** Read by screen readers instead of the drawing. */
  description: string
  height?: number
}

const WIDTH = 320
const TOP = 8
const BOTTOM = 4
const LABEL_COUNT = 4

/**
 * Lightweight SVG chart: area + line for the value, dashed line for the baseline.
 * The drawing stretches to the container width; date labels are HTML so they never distort.
 */
export function AreaChart({ points, description, height = 120 }: AreaChartProps) {
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Pas encore assez de données pour tracer une courbe.
      </p>
    )
  }

  const values = points.flatMap((point) =>
    point.baseline === undefined ? [point.value] : [point.value, point.baseline],
  )
  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = (max - min) * 0.08 || max * 0.02 || 1
  const low = min - padding
  const high = max + padding

  const x = (index: number) => (index / (points.length - 1)) * WIDTH
  const y = (value: number) => TOP + (1 - (value - low) / (high - low)) * (height - TOP - BOTTOM)

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`,
    )
    .join('')
  const areaPath = `${linePath}L${WIDTH} ${height}L0 ${height}Z`
  const hasBaseline = points.some((point) => point.baseline !== undefined)
  const baselinePath = hasBaseline
    ? points
        .map((point, index) =>
          point.baseline === undefined
            ? ''
            : `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)} ${y(point.baseline).toFixed(2)}`,
        )
        .join('')
    : ''
  const last = points.at(-1)

  const labelIndexes = Array.from({ length: LABEL_COUNT }, (_, slot) =>
    Math.round((slot / (LABEL_COUNT - 1)) * (points.length - 1)),
  )

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={description}
        className="block h-[var(--chart-height)] w-full overflow-visible"
        style={{ ['--chart-height' as string]: `${height}px` }}
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2={WIDTH}
            y1={TOP + fraction * (height - TOP - BOTTOM)}
            y2={TOP + fraction * (height - TOP - BOTTOM)}
            stroke="var(--color-line)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={areaPath} fill="var(--color-accent)" fillOpacity="0.14" />
        {hasBaseline && (
          <path
            d={baselinePath}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth="1.2"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {last && (
          <circle
            cx={WIDTH}
            cy={y(last.value)}
            r="3.5"
            fill="var(--color-accent)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-muted" aria-hidden="true">
        {labelIndexes.map((pointIndex, slot) => (
          <span key={slot}>{formatMonth(points[pointIndex].date)}</span>
        ))}
      </div>
    </figure>
  )
}
