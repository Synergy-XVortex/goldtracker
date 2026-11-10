import { useState } from 'react'
import { Link } from 'react-router'
import { Page } from '../../components/AppShell'
import { AreaChart } from '../../components/AreaChart'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StateMessage } from '../../components/StateMessage'
import { filterByPeriod, latestChange, PERIODS, type Period } from '../../domain/priceHistory'
import {
  formatDate,
  formatEuros,
  formatGrams,
  formatSignedEuros,
  formatSignedPercent,
} from '../../lib/format'
import { usePortfolioView } from './usePortfolioView'

export function DashboardPage() {
  const { view, isPending, isError, hasNoPortfolio } = usePortfolioView()
  const [period, setPeriod] = useState<Period>('6M')

  if (isPending)
    return (
      <Page title="Accueil">
        <StateMessage>Chargement du portefeuille…</StateMessage>
      </Page>
    )
  if (hasNoPortfolio) {
    return (
      <Page title="Accueil">
        <StateMessage>
          Votre compte n'est rattaché à aucun portefeuille. Demandez une invitation à
          l'administrateur.
        </StateMessage>
      </Page>
    )
  }
  if (isError || !view) {
    return (
      <Page title="Accueil">
        <StateMessage tone="error">
          Le portefeuille ne peut pas être chargé. Réessayez dans un instant.
        </StateMessage>
      </Page>
    )
  }

  const { total } = view
  const own = view.participants.find((participant) => participant.id === view.data.ownParticipantId)
  const isGain = total.gainCents >= 0

  return (
    <Page title={own ? `Bonjour ${own.displayName}` : view.data.name}>
      <section className="flex flex-col gap-2" aria-label="Valeur du portefeuille">
        <p className="text-xs text-muted">Valeur du portefeuille {view.data.name.toLowerCase()}</p>
        <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
          {formatEuros(total.valueCents)}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {total.gainRatio !== null && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono ${isGain ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}
            >
              {formatSignedPercent(total.gainRatio)}
            </span>
          )}
          <span className={`font-mono ${isGain ? 'text-gain' : 'text-loss'}`}>
            {formatSignedEuros(total.gainCents)}
          </span>
        </p>
        <p className="text-xs text-muted">
          sur {formatEuros(total.investedCents)} investis · {formatGrams(total.grams)} d'or
          {view.valuationDate && <> · cotation du {formatDate(view.valuationDate)}</>}
        </p>
      </section>

      <SegmentedControl
        label="Période"
        name="dashboard-period"
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        size="small"
      />
      <AreaChart
        points={filterByPeriod(view.history, period).map((point) => ({
          date: point.date,
          value: point.valueCents,
          baseline: point.investedCents,
        }))}
        description="Valeur du portefeuille comparée au montant investi (pointillés)"
      />

      {own && (
        <Link
          to="/portefeuille"
          className="flex items-center justify-between rounded-card border border-surface-line bg-surface p-4"
        >
          <span className="flex flex-col">
            <span className="text-xs text-muted">Votre part</span>
            <span className="font-mono font-semibold tabular-nums">
              {formatEuros(own.holding.valueCents)}
            </span>
          </span>
          <span
            className={`font-mono text-sm font-semibold ${own.holding.gainCents >= 0 ? 'text-gain' : 'text-loss'}`}
          >
            {formatSignedEuros(own.holding.gainCents)}
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        {view.prices.map(({ product, quotes }) => {
          const latest = quotes.at(-1)
          const change = latestChange(quotes)
          return (
            <Link
              key={product.id}
              to="/cours"
              className="flex flex-col gap-1 rounded-card border border-surface-line bg-surface p-3"
            >
              <span className="text-xs text-muted">{product.label}</span>
              <span className="font-mono font-semibold tabular-nums">
                {latest ? formatEuros(latest.quoteCents) : '—'}
              </span>
              {change && (
                <span
                  className={`text-xs font-semibold ${change.cents >= 0 ? 'text-gain' : 'text-loss'}`}
                >
                  {change.cents >= 0 ? '▲' : '▼'} {formatSignedPercent(change.ratio)}
                </span>
              )}
              {latest && (
                <span className="text-[10px] text-muted">
                  Cotation du {formatDate(latest.date)}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </Page>
  )
}
