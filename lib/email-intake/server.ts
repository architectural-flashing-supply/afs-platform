import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { anthropicTakeoffModel } from '@/lib/ai/takeoff-run';
import { anthropicIntentClassifier } from '@/lib/email-intake/classify';
import type { PipelineDeps } from '@/lib/email-intake/pipeline';
import { createSupabaseEmailStore } from '@/lib/email-intake/store-supabase';

/** Server-only wiring: production store + the real takeoff model + the AI classifier (when a key exists). */
export function buildProductionDeps(): PipelineDeps {
  return {
    store: createSupabaseEmailStore(),
    model: anthropicTakeoffModel(),
    classifier: process.env.ANTHROPIC_API_KEY ? anthropicIntentClassifier() : null,
  };
}

export interface AdminCaller {
  id: string;
  email: string;
}

/** The signed-in admin, or null. API routes use this (pages use requireAdminUser, which redirects). */
export async function getAdminCaller(): Promise<AdminCaller | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') return null;
  return { id: user.id, email: user.email ?? '' };
}

/** Shared-secret check for machine callers (a mail forwarder, a Power Automate flow). Constant time. */
export function hasValidIntakeSecret(headerValue: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = env.EMAIL_INTAKE_SECRET;
  if (!expected || expected.length < 24 || !headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const MAX_EML_BYTES = 30 * 1024 * 1024;
