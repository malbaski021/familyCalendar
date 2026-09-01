'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { ensureSuperAdmin } from '@/lib/auth/super-admin';
import {
  loginSchema,
  newPasswordSchema,
  resetPasswordRequestSchema,
  type LoginInput,
  type NewPasswordInput,
  type ResetPasswordRequestInput,
} from './schemas';

export type AuthResult = { ok: true } | { ok: false; error: string };

function defaultLocalePath(path: string): string {
  return `/${routing.defaultLocale}${path.startsWith('/') ? path : `/${path}`}`;
}

// NOTE: there is deliberately no self-service `signUpAction`. Registration is
// invite-only (F3): the admin issues an owner invite, owners issue member
// invites, and `acceptInviteAction` in `@/lib/family/actions` is the only path
// that creates an account. An open signup route also meant anyone could
// register the hardcoded `SUPER_ADMIN_EMAIL` and be auto-promoted to admin by
// `ensureSuperAdmin`, so this is a closed door, not a missing feature.

export async function loginAction(input: LoginInput, redirectTo?: string): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: error.message };
  }

  if (signInData.user) {
    await ensureSuperAdmin({ userId: signInData.user.id, email: signInData.user.email });
  }

  redirect(redirectTo && redirectTo.startsWith('/') ? redirectTo : defaultLocalePath('/calendar'));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(defaultLocalePath('/login'));
}

export async function requestPasswordResetAction(
  input: ResetPasswordRequestInput,
  origin: string,
): Promise<AuthResult> {
  const parsed = resetPasswordRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}${defaultLocalePath('/reset-password')}`,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updatePasswordAction(input: NewPasswordInput): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
