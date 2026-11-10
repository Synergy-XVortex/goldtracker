import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Page } from '../../components/AppShell'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StateMessage } from '../../components/StateMessage'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { formatEuros } from '../../lib/format'
import { supabase } from '../../lib/supabaseClient'
import { usePortfolio, type PortfolioData, type PortfolioPurchase } from '../portfolio/portfolioApi'
import { usePrices, type Product } from '../prices/pricesApi'
import {
  buildShares,
  centsToInput,
  parseEuroInput,
  splitTotalCents,
  todayInParis,
  type ShareInput,
} from './purchaseForm'

/** Create (/achats/nouveau) or edit (/achats/:purchaseId) a purchase. Admins only. */
export function PurchaseFormPage() {
  const { purchaseId } = useParams()
  const portfolio = usePortfolio()
  const prices = usePrices()
  const title = purchaseId ? "Modifier l'achat" : 'Nouvel achat'

  if (portfolio.isPending || prices.isPending) {
    return (
      <Page title={title}>
        <StateMessage>Chargement…</StateMessage>
      </Page>
    )
  }
  if (!portfolio.data || !prices.data) {
    return (
      <Page title={title}>
        <StateMessage tone="error">Le portefeuille ne peut pas être chargé.</StateMessage>
      </Page>
    )
  }
  if (portfolio.data.role !== 'admin') {
    return (
      <Page title={title}>
        <StateMessage>Seul l'administrateur du portefeuille peut saisir des achats.</StateMessage>
      </Page>
    )
  }

  const existing = purchaseId
    ? portfolio.data.purchases.find((purchase) => purchase.id === purchaseId)
    : undefined
  if (purchaseId && !existing) {
    return (
      <Page title={title}>
        <StateMessage tone="error">Cet achat n'existe plus.</StateMessage>
      </Page>
    )
  }

  return (
    <Page title={title}>
      <PurchaseForm
        // Remount when switching between purchases so the fields start from the right data.
        key={purchaseId ?? 'new'}
        portfolio={portfolio.data}
        products={prices.data.map((entry) => entry.product)}
        existing={existing}
      />
    </Page>
  )
}

interface PurchaseFormProps {
  portfolio: PortfolioData
  products: Product[]
  existing: PortfolioPurchase | undefined
}

function PurchaseForm({ portfolio, products, existing }: PurchaseFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const online = useOnlineStatus()
  const participants = portfolio.participants

  const [productId, setProductId] = useState(existing?.productId ?? products[0]?.id ?? 0)
  const [purchasedOn, setPurchasedOn] = useState(existing?.purchasedOn ?? todayInParis())
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 1))
  const [total, setTotal] = useState(existing ? centsToInput(existing.totalPriceCents) : '')
  const [fees, setFees] = useState(existing?.feesCents ? centsToInput(existing.feesCents) : '')
  const [seller, setSeller] = useState(existing?.seller ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [split, setSplit] = useState((existing?.shares.length ?? 1) > 1)
  const [singleParticipantId, setSingleParticipantId] = useState(
    existing?.shares.length === 1
      ? existing.shares[0].participantId
      : (portfolio.ownParticipantId ?? participants[0]?.id ?? ''),
  )
  const [splitShares, setSplitShares] = useState<ShareInput[]>(() =>
    participants.map((participant) => {
      const share = existing?.shares.find((entry) => entry.participantId === participant.id)
      return { participantId: participant.id, amount: share ? centsToInput(share.paidCents) : '' }
    }),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const totalCents = parseEuroInput(total)
  const sharedCents = splitTotalCents(splitShares)

  async function afterWrite() {
    await queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    navigate('/portefeuille')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const quantityValue = Number(quantity)
    if (!Number.isInteger(quantityValue) || quantityValue < 1) {
      setError('La quantité doit être un nombre entier supérieur à zéro.')
      return
    }
    const feesCents = fees.trim() === '' ? 0 : parseEuroInput(fees)
    if (feesCents === null) {
      setError('Le montant des frais est invalide.')
      return
    }
    const shares = buildShares({ totalCents, split, singleParticipantId, splitShares })
    if (!shares.ok) {
      setError(shares.error)
      return
    }

    setSaving(true)
    const { error: saveError } = await supabase.rpc('save_purchase', {
      // null creates a new purchase; the generated types do not model nullable function arguments.
      p_purchase_id: existing?.id ?? (null as unknown as string),
      p_portfolio_id: portfolio.portfolioId,
      p_product_id: productId,
      p_quantity: quantityValue,
      p_purchased_on: purchasedOn,
      p_total_price_cents: totalCents ?? 0,
      p_fees_cents: feesCents,
      p_seller: seller,
      p_note: note,
      p_shares: shares.shares,
    })
    setSaving(false)
    if (saveError) {
      setError("L'enregistrement a échoué. Vérifiez les montants puis réessayez.")
      return
    }
    await afterWrite()
  }

  async function deletePurchase() {
    if (!existing) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('purchases').delete().eq('id', existing.id)
    setSaving(false)
    if (deleteError) {
      setError('La suppression a échoué. Réessayez.')
      return
    }
    await afterWrite()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-6 md:max-w-xl">
      <SegmentedControl
        label="Produit"
        name="purchase-product"
        options={products.map((product) => ({ value: product.id, label: product.label }))}
        value={productId}
        onChange={setProductId}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date d'achat" htmlFor="purchase-date">
          <input
            id="purchase-date"
            type="date"
            required
            value={purchasedOn}
            onChange={(event) => setPurchasedOn(event.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Quantité" htmlFor="purchase-quantity">
          <input
            id="purchase-quantity"
            type="number"
            min={1}
            step={1}
            required
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="Prix total payé (€), frais compris" htmlFor="purchase-total">
        <input
          id="purchase-total"
          required
          inputMode="decimal"
          placeholder="1253,50"
          value={total}
          onChange={(event) => setTotal(event.target.value)}
          className={`${INPUT_CLASS} font-mono`}
        />
      </Field>

      <label className="flex items-center justify-between gap-3 text-sm font-semibold">
        Partager l'achat entre plusieurs personnes
        <input
          type="checkbox"
          checked={split}
          onChange={(event) => setSplit(event.target.checked)}
          className="size-5 accent-[var(--color-accent)]"
        />
      </label>

      {split ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Montant payé par chacun (€)</legend>
          {splitShares.map((share, index) => {
            const participant = participants.find((entry) => entry.id === share.participantId)
            return (
              <label
                key={share.participantId}
                className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm"
              >
                {participant?.displayName}
                <input
                  inputMode="decimal"
                  value={share.amount}
                  onChange={(event) =>
                    setSplitShares((current) =>
                      current.map((entry, position) =>
                        position === index ? { ...entry, amount: event.target.value } : entry,
                      ),
                    )
                  }
                  className={`${INPUT_CLASS} text-right font-mono`}
                />
              </label>
            )
          })}
          <p
            className={`text-xs font-semibold ${totalCents !== null && sharedCents === totalCents ? 'text-gain' : 'text-muted'}`}
            aria-live="polite"
          >
            Réparti : {formatEuros(sharedCents)} sur{' '}
            {totalCents === null ? '—' : formatEuros(totalCents)}
          </p>
        </fieldset>
      ) : (
        <Field label="Payé par" htmlFor="purchase-owner">
          <select
            id="purchase-owner"
            value={singleParticipantId}
            onChange={(event) => setSingleParticipantId(event.target.value)}
            className={INPUT_CLASS}
          >
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.displayName}
              </option>
            ))}
          </select>
        </Field>
      )}

      <details className="rounded-card border border-surface-line bg-surface p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Détails facultatifs</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Dont frais (€)" htmlFor="purchase-fees">
            <input
              id="purchase-fees"
              inputMode="decimal"
              value={fees}
              onChange={(event) => setFees(event.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
          <Field label="Vendeur" htmlFor="purchase-seller">
            <input
              id="purchase-seller"
              value={seller}
              onChange={(event) => setSeller(event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Note" htmlFor="purchase-note">
            <textarea
              id="purchase-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </details>

      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
      {!online && (
        <p role="status" className="text-sm text-muted">
          Hors ligne : l'enregistrement sera possible au retour du réseau.
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !online}
        className="rounded-control bg-accent px-4 py-3 font-bold text-on-accent disabled:opacity-60"
      >
        {saving ? 'Enregistrement…' : "Enregistrer l'achat"}
      </button>

      {existing &&
        (confirmingDelete ? (
          <div className="flex flex-col gap-2 rounded-card border border-loss p-3 text-sm">
            <p>Supprimer définitivement cet achat et sa répartition ?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-control border border-control-line px-3 py-2 font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={deletePurchase}
                disabled={saving || !online}
                className="rounded-control bg-loss px-3 py-2 font-semibold text-white disabled:opacity-60"
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-sm font-semibold text-loss underline"
          >
            Supprimer cet achat
          </button>
        ))}
    </form>
  )
}

const INPUT_CLASS =
  'w-full rounded-control border border-control-line bg-surface px-3 py-2.5 text-base outline-accent'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  )
}
