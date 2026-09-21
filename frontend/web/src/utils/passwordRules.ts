import { z } from 'zod';

/**
 * SINGLE SOURCE OF TRUTH for the password policy in this app.
 * It is used by the login form, the reset form and the PasswordRequirements
 * component. It mirrors the backend rule (IsStrongPassword): 8+ characters,
 * one uppercase, one lowercase and one symbol (any non letter/number).
 * The backend still re-checks everything - this is only for instant feedback.
 */
export type PasswordRuleId = 'length' | 'uppercase' | 'lowercase' | 'symbol';

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'uppercase', label: 'At least 1 uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'At least 1 lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'symbol', label: 'At least 1 special symbol (!@#$%^&*)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export interface PasswordRuleResult {
  id: PasswordRuleId;
  label: string;
  passed: boolean;
}

/** Returns one result per rule. An empty string fails every rule (=> all red). */
export function evaluatePasswordRules(value: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, passed: rule.test(value) }));
}

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/** Reusable Zod schema for any "password" field. */
export const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(isPasswordValid, { message: 'Password does not meet all requirements' });
