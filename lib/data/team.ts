export type CompanyRole = 'owner' | 'admin' | 'estimator' | 'pm' | 'accounting' | 'viewer';

export const COMPANY_ROLES: CompanyRole[] = ['owner', 'admin', 'estimator', 'pm', 'accounting', 'viewer'];

export function isCompanyRole(value: unknown): value is CompanyRole {
  return typeof value === 'string' && (COMPANY_ROLES as string[]).includes(value);
}

// Profile Passport (Phase 3, afs-pp-001) asked for an Admin/Editor/Viewer
// role system. Rather than adding a second, competing role column, this
// maps onto the existing company_role enum above (already live, already
// used by the real Team Accounts feature — app/account/team,
// app/api/team/invite) — see supabase/migrations/024_profile_passport_company_scope.sql's
// own header comment for the full reasoning.
export type PassportRole = 'admin' | 'editor' | 'viewer';

const PASSPORT_ADMIN_ROLES: CompanyRole[] = ['owner', 'admin'];
const PASSPORT_EDITOR_OR_ABOVE_ROLES: CompanyRole[] = ['owner', 'admin', 'estimator', 'pm', 'accounting'];

/**
 * `companyId === null` means this user isn't on a team account at all —
 * they get full ("admin") control over their own stuff, matching
 * saved_configurations' pre-Phase-3 per-user behavior exactly (see the
 * migration's `company_id IS NULL` policy fallback clauses). Once on a
 * company account, role comes from company_role.
 */
export function getPassportRole(companyId: string | null, companyRole: string | null): PassportRole {
  if (!companyId) return 'admin';
  if (companyRole && PASSPORT_ADMIN_ROLES.includes(companyRole as CompanyRole)) return 'admin';
  if (companyRole && PASSPORT_EDITOR_OR_ABOVE_ROLES.includes(companyRole as CompanyRole)) return 'editor';
  return 'viewer';
}
