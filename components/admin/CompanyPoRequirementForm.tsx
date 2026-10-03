'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerCompany } from '@/lib/data/customers';
import { PO_REQUIRED_HINT } from '@/lib/checkout/po-number';

/**
 * SPEC_PURCHASE_ORDER_INTEGRATION.md §3 — "Admin sets per company in
 * /admin/customers/{id}".
 *
 * The requirement is a column on `companies`, not on `profiles`, so it applies
 * to every member of the company at once. That is said out loud in the UI,
 * because an admin flipping it on one customer's page is really changing
 * checkout for all of their colleagues.
 *
 * WHY THE NO-COMPANY CASE IS COPY AND NOT A DISABLED CHECKBOX. `company_id` is
 * nullable and is only set by the Team Accounts flow, so most individual
 * customers have no `companies` row at all. A greyed-out checkbox would look
 * like a setting that exists for them and silently do nothing; the explanation
 * says where the setting actually lives.
 *
 * Gunmetal, not the light working area: `/admin/customers/[id]` is not in
 * lib/data/admin-working-area.ts's list (CLAUDE.md rule #18), so the tokens
 * here mirror CustomerAccountSettingsForm's — which already clear the contrast
 * gate (rule #28) on this surface. Error and success text use the
 * `*-on-dark` variants required by rule #29.
 */
interface CompanyPoRequirementFormProps {
  company: CustomerCompany | null;
  /** Shown in the no-company state so the copy can name the person. */
  customerName: string;
}

const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

export default function CompanyPoRequirementForm({ company, customerName }: CompanyPoRequirementFormProps) {
  const router = useRouter();
  const [requirePo, setRequirePo] = useState(company?.requirePo ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = company !== null && requirePo !== company.requirePo;

  async function handleSave() {
    if (!company || !dirty) return;
    const confirmed = window.confirm(
      requirePo
        ? `Require a PO number on all orders from ${company.name}? Every member of this company will have to enter one at checkout. This is logged to the admin audit trail.`
        : `Stop requiring a PO number on orders from ${company.name}? Members will still be able to enter one. This is logged to the admin audit trail.`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirePo }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save the PO requirement. Nothing was changed.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not save the PO requirement. Nothing was changed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Purchase Order Requirement</h2>

      {company === null ? (
        <div>
          <p className="font-body text-sm text-afs-chrome-mid">
            {customerName} has no company account on file, so there is nothing to attach a PO requirement to.
          </p>
          <p className="font-body text-sm text-afs-chrome-mid mt-3">
            The requirement is set per company, not per person — it applies to every member at once. A company
            account is created when a customer invites their first colleague through Team Accounts.
          </p>
          <p className="font-body text-xs text-afs-chrome-silver mt-3">
            PO numbers are still optional for this customer at checkout, and any they enter is saved to the order.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <span className={labelClass}>Company Account</span>
            <p className="font-body text-sm text-afs-chrome-high">{company.name}</p>
          </div>

          <label className="flex items-start gap-3 mb-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={requirePo}
              onChange={(e) => setRequirePo(e.target.checked)}
              disabled={submitting}
              className="w-4 h-4 accent-afs-crimson mt-0.5"
            />
            <span className="font-body text-sm text-afs-chrome-high">Require PO Number on all orders</span>
          </label>

          <p className="font-body text-xs text-afs-chrome-silver mb-6">
            {requirePo
              ? `Checkout will show "${PO_REQUIRED_HINT}" and block Place Order until a PO number is entered — for every member of ${company.name}.`
              : `Members of ${company.name} may enter a PO number at checkout, but are not required to.`}
          </p>

          <div className="flex items-center justify-between gap-4">
            <div>
              {error && <p className="font-body text-xs text-afs-danger-on-dark">{error}</p>}
              {saved && !error && (
                <p className="font-body text-xs text-afs-success-on-dark">PO requirement saved.</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !dirty}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Save PO Requirement'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
