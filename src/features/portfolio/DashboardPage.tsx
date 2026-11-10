import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Page } from '../../components/AppShell'
import { AreaChart } from '../../components/AreaChart'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StateMessage } from '../../components/StateMessage'
import type { Holding } from '../../domain/holdings'
import { filterByPeriod, latestChange, PERIODS, type Period } from '../../domain/priceHistory'
import {
  formatDate,
  formatEuros,
  formatGrams,
  formatSignedEuros,
  formatSignedPercent,
} from '../../lib/format'
import { useAuth } from '../auth/AuthProvider'
import { displayedHistory, useDisplayedPortfolio } from './displayedPortfolio'
import { usePortfolioView, type PortfolioView } from './usePortfolioView'

export function DashboardPage() {
  const { view, isPending, isError, hasNoPortfolio } = usePortfolioView()

  if (isPending) {
    return (
      <Page title="Accueil">
        <StateMessage>Chargement du portefeuille…</StateMessage>
      </Page>
    )
  }
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
  return <Dashboard view={view} />
}

function Dashboard({ view }: { view: PortfolioView }) {
  const { session } = useAuth()
  const [period, setPeriod] = useState<Period>('6M')
  const { choice } = useDisplayedPortfolio(
    session?.user.id,
    view.participants.map((participant) => participant.id),
    view.data.ownParticipantId,
  )

  const own = view.participants.find((participant) => participant.id === view.data.ownParticipantId)
  const shown =
    choice.kind === 'participant'
      ? view.participants.find((participant) => participant.id === choice.participantId)
      : undefined
  const holding: Holding = shown?.holding ?? view.total
  const label = shown
    ? `Portefeuille de ${shown.displayName}`
    : `Portefeuille ${view.data.name.toLowerCase()}`

  const history = useMemo(
    () => displayedHistory(choice, view.data.purchases, view.quotesByProduct),
    [choice, view.data.purchases, view.quotesByProduct],
  )
  const isGain = holding.gainCents >= 0

  return (
    <Page title={own ? `Bonjour ${own.displayName}` : view.data.name}>
      <section className="flex flex-col gap-2" aria-label={label}>
        <p className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>{label}</span>
          <Link to="/reglages" className="font-semibold text-accent-ink">
            Changer
          </Link>
        </p>
        <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
          {formatEuros(holding.valueCents)}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {holding.gainRatio !== null && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono ${isGain ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}
            >
              {formatSignedPercent(holding.gainRatio)}
            </span>
          )}
          <span className={`font-mono ${isGain ? 'text-gain' : 'text-loss'}`}>
            {formatSignedEuros(holding.gainCents)}
          </span>
        </p>
        <p className="text-xs text-muted">
          sur {formatEuros(holding.investedCents)} investis · {formatGrams(holding.grams)} d'or
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
        points={filterByPeriod(history, period).map((point) => ({
          date: point.date,
          value: point.valueCents,
          baseline: point.investedCents,
        }))}
        description={`${label} : valeur comparée au montant investi (pointillés)`}
      />

      {shown ? (
        <SummaryLink title={`Toute la ${view.data.name.toLowerCase()}`} holding={view.total} />
      ) : (
        own && <SummaryLink title="Votre part" holding={own.holding} />
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

function SummaryLink({ title, holding }: { title: string; holding: Holding }) {
  return (
    <Link
      to="/portefeuille"
      className="flex items-center justify-between rounded-card border border-surface-line bg-surface p-4"
    >
      <span className="flex flex-col">
        <span className="text-xs text-muted">{title}</span>
        <span className="font-mono font-semibold tabular-nums">
          {formatEuros(holding.valueCents)}
        </span>
      </span>
      <span
        className={`font-mono text-sm font-semibold ${holding.gainCents >= 0 ? 'text-gain' : 'text-loss'}`}
      >
        {formatSignedEuros(holding.gainCents)}
      </span>
    </Link>
  )
}
