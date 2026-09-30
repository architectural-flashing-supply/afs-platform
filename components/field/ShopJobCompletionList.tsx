'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import DeliveryPhotoCapture from '@/components/field/DeliveryPhotoCapture';
import type { FieldShopQueueRow } from '@/lib/data/shop-library';

type JobState = 'idle' | 'submitting' | 'done' | 'failed';

interface ApiErrorResponse {
  error: string;
}

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null && 'error' in data && typeof (data as ApiErrorResponse).error === 'string';
}

// Exact literal the prompt requires — do not paraphrase into anything that
// could read as delivery/invoice/email already having happened. Marking a
// job complete here writes only shop_profile_library.status/completed_at
// and a completion_events row; it fires no Resend/Twilio/other API call.
const COMPLETION_MESSAGE =
  'Job marked complete. Delivery scheduling, invoice, and customer email will be sent automatically once integration is finalized.';

function jobLabel(job: FieldShopQueueRow): string {
  return job.jobName ?? job.profileName;
}

function jobSubtitle(job: FieldShopQueueRow): string | null {
  const parts = [job.customerName, job.company].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(' — ') : null;
}

interface JobCardProps {
  job: FieldShopQueueRow;
  state: JobState;
  error: string | null;
  onMarkComplete: () => void;
}

function JobCard({ job, state, error, onMarkComplete }: JobCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-afs-border bg-afs-bg-overlay p-4">
      <div>
        <p className="font-label text-lg uppercase tracking-wide text-afs-chrome-high">{jobLabel(job)}</p>
        {jobSubtitle(job) && <p className="font-body text-sm text-afs-chrome-mid">{jobSubtitle(job)}</p>}
        {job.orderNumber && <p className="font-body text-xs text-afs-chrome-dim">Order {job.orderNumber}</p>}
        {job.dueDate && <p className="font-body text-xs text-afs-chrome-dim">Due {job.dueDate}</p>}
      </div>

      {state === 'done' ? (
        <p className="font-body text-sm text-afs-chrome-high">{COMPLETION_MESSAGE}</p>
      ) : (
        <>
          {error && <p className="font-body text-sm text-afs-crimson">{error}</p>}
          <Button className="w-full py-4 text-lg" onClick={onMarkComplete} disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Marking Complete…' : 'Mark Complete'}
          </Button>
        </>
      )}

      {/* Independent of Mark Complete above — a job can get a delivery photo
          without being marked complete and vice versa (afs-fl-004). */}
      <DeliveryPhotoCapture shopProfileLibraryId={job.id} />
    </li>
  );
}

export default function ShopJobCompletionList({ initialJobs }: { initialJobs: FieldShopQueueRow[] }) {
  const [jobStates, setJobStates] = useState<Record<string, JobState>>({});
  const [jobErrors, setJobErrors] = useState<Record<string, string | null>>({});

  const markComplete = async (jobId: string) => {
    setJobStates((prev) => ({ ...prev, [jobId]: 'submitting' }));
    setJobErrors((prev) => ({ ...prev, [jobId]: null }));

    try {
      const res = await fetch(`/api/field/shop/${jobId}/complete`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok || !data || isApiError(data)) {
        setJobStates((prev) => ({ ...prev, [jobId]: 'failed' }));
        setJobErrors((prev) => ({
          ...prev,
          [jobId]: isApiError(data) ? data.error : 'Could not mark this job complete. Please try again.',
        }));
        return;
      }
      setJobStates((prev) => ({ ...prev, [jobId]: 'done' }));
    } catch {
      setJobStates((prev) => ({ ...prev, [jobId]: 'failed' }));
      setJobErrors((prev) => ({ ...prev, [jobId]: 'Network error. Please try again.' }));
    }
  };

  if (initialJobs.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-3xl uppercase tracking-wide text-afs-chrome-high">Field — Shop</h1>
        <p className="font-body text-base text-afs-chrome-mid">No jobs in the queue right now.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-center font-heading text-3xl uppercase tracking-wide text-afs-chrome-high">
        Field — Shop
      </h1>

      <ul className="flex flex-col gap-4">
        {initialJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            state={jobStates[job.id] ?? 'idle'}
            error={jobErrors[job.id] ?? null}
            onMarkComplete={() => markComplete(job.id)}
          />
        ))}
      </ul>
    </main>
  );
}
