import { useState } from 'react'
import { AreaChart } from '../../components/AreaChart'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StateMessage } from '../../components/StateMessage'
import {
  extremes,
  filterByPeriod,
  latestChange,
  PERIODS,
  type Period,
} from '../../domain/priceHistory'
import { formatDate, formatEuros, formatSignedPercent } from '../../lib/format'
import { usePrices } from './pricesApi'

/** Public page: daily dealer quotes for each product. Shows no portfolio data. */
export function PricesContent() {
  const { data, isPending, isError } = usePrices()
  const [productCode, setProductCode] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('1A')

  if (isPending) return <StateMessage>Chargement des cours…</StateMessage>
  if (isError || !data || data.length === 0) {
    return (
      <StateMessage tone="error">
        Les cours ne peuvent pas être chargés. Réessayez dans un instant.
      </StateMessage>
    )
  }

  const selected = data.find((entry) => entry.product.code === productCode) ?? data[0]
  const latest = selected.quotes.at(-1)
  const change = latestChange(selected.quotes)
  const allTime = extremes(selected.quotes)
  const visible = filterByPeriod(selected.quotes, period)

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-start md:gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <SegmentedControl
          label="Produit"
          name="product"
          options={data.map((entry) => ({ value: entry.product.code, label: entry.product.label }))}
          value={selected.product.code}
          onChange={setProductCode}
        />

        {latest ? (
          <section className="flex flex-col gap-1.5" aria-label="Cotation du jour">
            <p className="text-xs text-muted">
              {latest.status === 'estimated' ? 'Estimation' : 'Cotation'} du{' '}
              {formatDate(latest.date)}
            </p>
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
              {formatEuros(latest.quoteCents)}
            </p>
            {change && (
              <p className="flex items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono font-semibold ${change.cents >= 0 ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}
                >
                  {change.cents >= 0 ? '▲' : '▼'} {formatSignedPercent(change.ratio)}
                </span>
                <span className="text-muted">depuis le cours précédent</span>
              </p>
            )}
            {latest.status === 'estimated' && (
              <p className="text-xs text-muted">
                La page du marchand n'a pas pu être lue : valeur estimée à partir du cours mondial
                de l'or.
              </p>
            )}
          </section>
        ) : (
          <StateMessage>Aucun cours publié pour ce produit.</StateMessage>
        )}

        <SegmentedControl
          label="Période"
          name="period"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          size="small"
        />
        <AreaChart
          points={visible.map((quote) => ({ date: quote.date, value: quote.quoteCents }))}
          description={`Cotation du ${selected.product.label} sur la période choisie`}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="divide-y divide-line rounded-card border border-surface-line bg-surface px-4 py-1 text-sm">
          {latest?.buyCents != null && (
            <PriceRow label="Prix d'achat (1 à 9 unités)" value={formatEuros(latest.buyCents)} />
          )}
          {latest?.buybackCents != null && (
            <PriceRow label="Prix de rachat" value={formatEuros(latest.buybackCents)} />
          )}
          {allTime && (
            <>
              <PriceRow
                label={`Plus haut · ${formatDate(allTime.highest.date)}`}
                value={formatEuros(allTime.highest.quoteCents)}
              />
              <PriceRow
                label={`Plus bas · ${formatDate(allTime.lowest.date)}`}
                value={formatEuros(allTime.lowest.quoteCents)}
              />
            </>
          )}
        </dl>

        <p className="text-center text-[11px] text-muted">
          Cotations relevées chaque jour ouvré sur achat-or-et-argent.fr, contrôlées avec le cours
          mondial fourni par{' '}
          <a
            href="https://metalpriceapi.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            MetalpriceAPI
          </a>
          .
        </p>
      </div>
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  )
}
