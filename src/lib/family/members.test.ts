import { describe, it, expect } from 'vitest';
import { sortFamilyMembers, type FamilyMemberSummary } from './members';

const m = (username: string, role: 'owner' | 'member'): FamilyMemberSummary => ({
  userId: `id-${username}`,
  username,
  role,
});

describe('sortFamilyMembers', () => {
  it('puts the owner first', () => {
    const sorted = sortFamilyMembers([m('mama', 'member'), m('tata', 'owner')]);
    expect(sorted.map((x) => x.username)).toEqual(['tata', 'mama']);
  });

  it('keeps the owner first even when alphabetically last', () => {
    const sorted = sortFamilyMembers([m('ana', 'member'), m('zoran', 'owner')]);
    expect(sorted.map((x) => x.username)).toEqual(['zoran', 'ana']);
  });

  it('sorts members alphabetically after the owner', () => {
    const sorted = sortFamilyMembers([
      m('mila', 'member'),
      m('ana', 'member'),
      m('tata', 'owner'),
      m('luka', 'member'),
    ]);
    expect(sorted.map((x) => x.username)).toEqual(['tata', 'ana', 'luka', 'mila']);
  });

  it('is case-insensitive, so casing cannot reshuffle the list', () => {
    const sorted = sortFamilyMembers([m('Zoe', 'member'), m('ana', 'member'), m('Bob', 'member')]);
    expect(sorted.map((x) => x.username)).toEqual(['ana', 'Bob', 'Zoe']);
  });

  it('handles several owners deterministically', () => {
    const sorted = sortFamilyMembers([
      m('member1', 'member'),
      m('owner2', 'owner'),
      m('owner1', 'owner'),
    ]);
    expect(sorted.map((x) => x.username)).toEqual(['owner1', 'owner2', 'member1']);
  });

  it('does not mutate the input', () => {
    const input = [m('mama', 'member'), m('tata', 'owner')];
    sortFamilyMembers(input);
    expect(input.map((x) => x.username)).toEqual(['mama', 'tata']);
  });

  it('handles empty and single-entry lists', () => {
    expect(sortFamilyMembers([])).toEqual([]);
    expect(sortFamilyMembers([m('solo', 'owner')]).map((x) => x.username)).toEqual(['solo']);
  });
});
