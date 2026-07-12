'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CustomerAccountSettingsFormProps {
  customerId: string;
  initial: {
    role: string;
    pricingTier: string;
    netTerms: number;
    creditLimit: number | null;
    taxExempt: boolean;
  };
}

const ROLE_OPTIONS = ['admin', 'contractor', 'architect', 'customer'];
const TIER_OPTIONS = ['standard', 'contractor', 'preferred', 'wholesale'];
const NET_TERMS_OPTIONS = [0, 15, 30, 60];

const selectClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5';

export default function CustomerAccountSettingsForm({ customerId, initial }: CustomerAccountSettingsFormProps) {
  const router = useRouter();
  const [role, setRole] = useState(initial.role);
  const [pricingTier, setPricingTier] = useState(initial.pricingTier);
  const [netTerms, setNetTerms] = useState(initial.netTerms);
  const [creditLimit, setCreditLimit] = useState(initial.creditLimit != null ? String(initial.creditLimit) : '');
  const [taxExempt, setTaxExempt] = useState(initial.taxExempt);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    role !== initial.role ||
    pricingTier !== initial.pricingTier ||
    netTerms !== initial.netTerms ||
    creditLimit !== (initial.creditLimit != null ? String(initial.creditLimit) : '') ||
    taxExempt !== initial.taxExempt;

  async function handleSave() {
    if (!dirty) return;
    const confirmed = window.confirm('Save these account setting changes? This is logged to the admin audit trail.');
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSettings: {
            role,
            pricingTier,
            netTerms,
            creditLimit: creditLimit.trim() === '' ? null : Number(creditLimit),
            taxExempt,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save account settings.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not save account settings.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h2 className="font-heading text-lg text-afs-ink-900 mb-4">Account Settings</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass} htmlFor="role">
            Role
          </label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="pricing-tier">
            Pricing Tier
          </label>
          <select
            id="pricing-tier"
            value={pricingTier}
            onChange={(e) => setPricingTier(e.target.value)}
            className={selectClass}
          >
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="net-terms">
            Net Terms
          </label>
          <select
            id="net-terms"
            value={netTerms}
            onChange={(e) => setNetTerms(Number(e.target.value))}
            className={selectClass}
          >
            {NET_TERMS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Due on Receipt' : `Net ${n}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="credit-limit">
            Credit Limit ($)
          </label>
          <input
            id="credit-limit"
            type="number"
            min="0"
            step="0.01"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="0.00"
            className={`${selectClass} font-data`}
          />
        </div>
      </div>

      <label className="flex items-center gap-3 mb-6 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={taxExempt}
          onChange={(e) => setTaxExempt(e.target.checked)}
          className="w-4 h-4 accent-afs-crimson"
        />
        <span className="font-body text-sm text-afs-ink-900">Tax Exempt</span>
      </label>

      <div className="flex items-center justify-between gap-4">
        <div>
          {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
          {saved && !error && <p className="font-body text-xs text-afs-success">Account settings saved.</p>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || !dirty}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save Account Settings'}
        </button>
      </div>
    </div>
  );
}
