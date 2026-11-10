import { Page } from '../../components/AppShell'
import { StateMessage } from '../../components/StateMessage'
import {
  formatDate,
  formatEuros,
  formatGrams,
  formatSignedEuros,
  formatSignedPercent,
} from '../../lib/format'
import { usePortfolioView } from './usePortfolioView'

/** Shares of the weight use the gold scale of the theme, darkest first. */
const SHARE_SHADES = [
  'var(--color-accent)',
  'color-mix(in srgb, var(--color-accent) 70%, var(--color-bg))',
  'color-mix(in srgb, var(--color-accent) 45%, var(--color-bg))',
  'color-mix(in srgb, var(--color-accent) 25%, var(--color-bg))',
]

export function PortfolioPage() {
  const { view, isPending, isError, hasNoPortfolio } = usePortfolioView()

  if (isPending)
    return (
      <Page title="Portefeuille">
        <StateMessage>Chargement du portefeuille…</StateMessage>
      </Page>
    )
  if (hasNoPortfolio) {
    return (
      <Page title="Portefeuille">
        <StateMessage>Votre compte n'est rattaché à aucun portefeuille.</StateMessage>
      </Page>
    )
  }
  if (isError || !view) {
    return (
      <Page title="Portefeuille">
        <StateMessage tone="error">Le portefeuille ne peut pas être chargé.</StateMessage>
      </Page>
    )
  }

  const productLabels = new Map(view.prices.map(({ product }) => [product.id, product.label]))
  const names = new Map(
    view.data.participants.map((participant) => [participant.id, participant.displayName]),
  )
  const shade = (index: number) => SHARE_SHADES[index % SHARE_SHADES.length]

  return (
    <Page title="Portefeuille">
      <section
        className="flex flex-col gap-3 rounded-card border border-surface-line bg-surface p-4"
        aria-label="Synthèse"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Or détenu</p>
            <p className="font-mono font-semibold tabular-nums">{formatGrams(view.total.grams)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Plus-value</p>
            <p
              className={`font-mono font-semibold tabular-nums ${view.total.gainCents >= 0 ? 'text-gain' : 'text-loss'}`}
            >
              {formatSignedEuros(view.total.gainCents)}
            </p>
          </div>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-chip" aria-hidden="true">
          {view.participants.map((participant, index) => (
            <span
              key={participant.id}
              style={{
                width: `${(participant.holding.grams / view.total.grams) * 100}%`,
                background: shade(index),
              }}
            />
          ))}
        </div>
        <p className="text-xs text-muted">
          Répartition du poids entre {view.participants.length} participants
        </p>
      </section>

      <section
        aria-label="Participants"
        className="rounded-card border border-surface-line bg-surface px-4"
      >
        <ul className="divide-y divide-line">
          {view.participants.map((participant, index) => {
            const { holding } = participant
            const isGain = holding.gainCents >= 0
            const isOwn = participant.id === view.data.ownParticipantId
            return (
              <li
                key={participant.id}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3"
              >
                <span
                  className="grid size-8 place-items-center rounded-full bg-chip text-xs font-bold"
                  style={{ boxShadow: `inset 0 0 0 2px ${shade(index)}` }}
                  aria-hidden="true"
                >
                  {participant.displayName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {participant.displayName}
                    {isOwn && <span className="ml-1.5 text-xs font-normal text-muted">(vous)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatGrams(holding.grams)} · investi{' '}
                    <span className="font-mono">{formatEuros(holding.investedCents)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {formatEuros(holding.valueCents)}
                  </p>
                  <p
                    className={`font-mono text-xs tabular-nums ${isGain ? 'text-gain' : 'text-loss'}`}
                  >
                    {formatSignedEuros(holding.gainCents)}
                    {holding.gainRatio !== null && <> · {formatSignedPercent(holding.gainRatio)}</>}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="purchases-title" className="flex flex-col gap-2 pb-4">
        <h2 id="purchases-title" className="text-sm font-bold">
          Achats <span className="font-normal text-muted">({view.data.purchases.length})</span>
        </h2>
        <ul className="divide-y divide-line rounded-card border border-surface-line bg-surface px-4">
          {view.data.purchases.map((purchase) => (
            <li key={purchase.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">
                  {purchase.quantity > 1 && `${purchase.quantity} × `}
                  {productLabels.get(purchase.productId) ?? 'Produit'}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(purchase.purchasedOn)} ·{' '}
                  {purchase.shares.map((share) => names.get(share.participantId) ?? '?').join(', ')}
                </p>
              </div>
              <p className="font-mono tabular-nums">{formatEuros(purchase.totalPriceCents)}</p>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  )
}
