import type { SupabaseClient } from '@supabase/supabase-js';
import { getPassportRole, type PassportRole } from '@/lib/data/team';

export interface PassportPoint {
  x: number;
  y: number;
}

function isPassportPointArray(value: unknown): value is PassportPoint[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((p) => p && typeof p === 'object' && typeof (p as PassportPoint).x === 'number' && typeof (p as PassportPoint).y === 'number')
  );
}

export interface PassportUserContext {
  userId: string;
  companyId: string | null;
  companyRole: string | null;
  role: PassportRole;
}

/** Resolves who's asking and what they're allowed to do — every profile-passport route starts here. */
export async function getPassportUserContext(supabase: SupabaseClient): Promise<PassportUserContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('company_id, company_role').eq('id', user.id).single();
  const companyId = (profile?.company_id as string | null) ?? null;
  const companyRole = (profile?.company_role as string | null) ?? null;

  return { userId: user.id, companyId, companyRole, role: getPassportRole(companyId, companyRole) };
}

export interface PassportProfileRow {
  id: string;
  name: string;
  createdAt: string;
  jobName: string | null;
  isLocked: boolean;
  points: PassportPoint[];
  /** Real canvas screenshot (025_profile_passport_thumbnail.sql), a `data:image/png;base64,...` URI — null for rows saved before this column existed or without one captured. Callers fall back to rendering `points` via CanonicalProfileDiagram when this is null. */
  thumbnailImage: string | null;
  ownerId: string;
  ownerName: string;
}

interface PassportProfileSource {
  id: string;
  name: string | null;
  created_at: string;
  is_locked: boolean | null;
  job_info: { jobName?: string } | null;
  dimensions: { kind?: string; points?: unknown; jobName?: unknown; isLocked?: boolean } | null;
  thumbnail_image: string | null;
  user_id: string;
}

/**
 * RLS (024_profile_passport_company_scope.sql's profile_passport_select
 * policy) already restricts this to the caller's own rows or, on a company
 * account, every teammate's rows — no explicit .eq('user_id', ...) or
 * .eq('company_id', ...) filter needed here, matching this codebase's
 * existing RLS-does-the-scoping convention (e.g. lib/data/orders.ts).
 * Reads is_locked/job_info from the new top-level columns first, falling
 * back to the dimensions JSONB fields (afs-fl-027/afs-jf-006) they replace
 * — a row saved by FlashDraft before this phase's migration was applied
 * still displays correctly.
 */
export async function getPassportProfiles(supabase: SupabaseClient): Promise<PassportProfileRow[]> {
  const { data } = await supabase
    .from('saved_configurations')
    .select('id, name, created_at, is_locked, job_info, dimensions, thumbnail_image, user_id')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as PassportProfileSource[];
  const flashdraftRows = rows.filter((r) => r.dimensions?.kind === 'flashdraft');
  if (flashdraftRows.length === 0) return [];

  const ownerIds = Array.from(new Set(flashdraftRows.map((r) => r.user_id)));
  const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', ownerIds);
  const nameById = new Map(((profileRows ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  return flashdraftRows
    .map((row) => {
      const points = isPassportPointArray(row.dimensions?.points) ? (row.dimensions!.points as PassportPoint[]) : [];
      const jobName =
        row.job_info?.jobName || (typeof row.dimensions?.jobName === 'string' ? row.dimensions.jobName : null) || null;
      return {
        id: row.id,
        name: row.name || 'Untitled Profile',
        createdAt: row.created_at,
        jobName,
        isLocked: row.is_locked ?? Boolean(row.dimensions?.isLocked),
        points,
        thumbnailImage: row.thumbnail_image ?? null,
        ownerId: row.user_id,
        ownerName: nameById.get(row.user_id) ?? 'Unknown',
      };
    })
    .filter((p) => p.points.length > 0);
}

export interface PassportAccountInfo {
  companyName: string | null;
  contactEmail: string;
  role: PassportRole;
  teamMembers: { id: string; name: string; email: string; role: string; isSelf: boolean }[];
}

/**
 * Deliberately thin — reuses the exact same profiles/companies query shape
 * app/account/team/page.tsx already uses, rather than a second
 * implementation of "who's on my team." Pending invitations are NOT
 * included here (that's /account/team's own concern); this is a read-only
 * summary for the Account tab, not a replacement for the full Team page.
 */
export async function getPassportAccountInfo(supabase: SupabaseClient, userId: string): Promise<PassportAccountInfo | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, company, company_id, company_role')
    .eq('id', userId)
    .single();
  if (!profile) return null;

  const companyId = profile.company_id as string | null;
  const companyRole = profile.company_role as string | null;
  const role = getPassportRole(companyId, companyRole);

  if (!companyId) {
    return {
      companyName: profile.company ?? null,
      contactEmail: profile.email,
      role,
      teamMembers: [{ id: profile.id, name: profile.full_name, email: profile.email, role: 'Owner', isSelf: true }],
    };
  }

  const [{ data: company }, { data: memberRows }] = await Promise.all([
    supabase.from('companies').select('name').eq('id', companyId).single(),
    supabase.from('profiles').select('id, full_name, email, company_role').eq('company_id', companyId).order('full_name'),
  ]);

  return {
    companyName: company?.name ?? profile.company ?? null,
    contactEmail: profile.email,
    role,
    teamMembers: ((memberRows ?? []) as { id: string; full_name: string; email: string; company_role: string | null }[]).map(
      (m) => ({ id: m.id, name: m.full_name, email: m.email, role: m.company_role ?? 'viewer', isSelf: m.id === userId })
    ),
  };
}
