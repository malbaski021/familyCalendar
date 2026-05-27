import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases ASCII names', () => {
    expect(slugify('Petrovic')).toBe('petrovic');
  });

  it('transliterates Serbian Latin diacritics', () => {
    expect(slugify('Đorđević')).toBe('djordjevic');
    expect(slugify('Šarić')).toBe('saric');
    expect(slugify('Žužić')).toBe('zuzic');
  });

  it('replaces whitespace and punctuation with single hyphens', () => {
    expect(slugify('The Smith Family!')).toBe('the-smith-family');
  });

  it('collapses repeated separators', () => {
    expect(slugify('foo   bar___baz')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --foo bar--  ')).toBe('foo-bar');
  });

  it('returns an empty string for symbol-only input', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('caps the length to 48 characters', () => {
    const long = 'a'.repeat(80);
    expect(slugify(long).length).toBe(48);
  });
});
