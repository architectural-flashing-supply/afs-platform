export type PasswordStrength = 'weak' | 'fair' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return 'weak';
  if (/^[A-Za-z]+$/.test(password)) return 'weak';

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (hasLower && hasUpper && hasNumber && hasSymbol) return 'strong';
  if ((hasLower && hasUpper) || hasNumber) return 'fair';
  return 'weak';
}
