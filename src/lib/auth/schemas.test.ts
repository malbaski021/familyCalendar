import { describe, it, expect } from 'vitest';
import {
  signUpSchema,
  loginSchema,
  resetPasswordRequestSchema,
  newPasswordSchema,
} from './schemas';

describe('signUpSchema', () => {
  it('accepts a valid input', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      username: 'good_user',
      password: 'longenough',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = signUpSchema.safeParse({
      email: 'not-an-email',
      username: 'good_user',
      password: 'longenough',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too-short username', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      username: 'ab',
      password: 'longenough',
    });
    expect(result.success).toBe(false);
  });

  it('rejects username with invalid characters', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      username: 'has spaces',
      password: 'longenough',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too-short password', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      username: 'good_user',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid input', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anything',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordRequestSchema', () => {
  it('accepts a valid email', () => {
    const result = resetPasswordRequestSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = resetPasswordRequestSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it('accepts matching passwords', () => {
    const result = newPasswordSchema.safeParse({
      password: 'longenough',
      confirmPassword: 'longenough',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = newPasswordSchema.safeParse({
      password: 'longenough',
      confirmPassword: 'different1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too-short password', () => {
    const result = newPasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});
