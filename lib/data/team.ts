export type CompanyRole = 'owner' | 'admin' | 'estimator' | 'pm' | 'accounting' | 'viewer';

export const COMPANY_ROLES: CompanyRole[] = ['owner', 'admin', 'estimator', 'pm', 'accounting', 'viewer'];

export function isCompanyRole(value: unknown): value is CompanyRole {
  return typeof value === 'string' && (COMPANY_ROLES as string[]).includes(value);
}
