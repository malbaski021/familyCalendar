import { describe, it, expect } from 'vitest';
import { buildFamilyRoster, sortFamilyMembers, type FamilyMemberSummary } from './members';

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

describe('buildFamilyRoster', () => {
  const members: FamilyMemberSummary[] = [
    { userId: 'u-mama', username: 'mama', role: 'member' },
    { userId: 'u-tata', username: 'tata', role: 'owner' },
  ];
  const children = [
    { id: 'c-mila', name: 'Mila' },
    { id: 'c-luka', name: 'Luka' },
  ];

  it('orders owner, then members, then children', () => {
    const roster = buildFamilyRoster(members, children);
    expect(roster.map((e) => e.role)).toEqual(['owner', 'member', 'child', 'child']);
    expect(roster.map((e) => e.name)).toEqual(['tata', 'mama', 'Luka', 'Mila']);
  });

  it('keeps the group order even when children sort first alphabetically', () => {
    const roster = buildFamilyRoster(
      [{ userId: 'u-zoran', username: 'zoran', role: 'owner' }],
      [{ id: 'c-ana', name: 'Ana' }],
    );
    expect(roster.map((e) => e.name)).toEqual(['zoran', 'Ana']);
  });

  it('sorts alphabetically within a group, case-insensitively', () => {
    const roster = buildFamilyRoster(
      [],
      [
        { id: '1', name: 'Zoe' },
        { id: '2', name: 'ana' },
        { id: '3', name: 'Bob' },
      ],
    );
    expect(roster.map((e) => e.name)).toEqual(['ana', 'Bob', 'Zoe']);
  });

  it('namespaces keys so an account and a child cannot collide', () => {
    // Both tables use their own uuid space; a bare id could repeat across them
    // and React would drop a row.
    const roster = buildFamilyRoster(
      [{ userId: 'same-id', username: 'tata', role: 'owner' }],
      [{ id: 'same-id', name: 'Luka' }],
    );
    expect(new Set(roster.map((e) => e.key)).size).toBe(2);
    expect(roster.map((e) => e.key)).toEqual(['user-same-id', 'child-same-id']);
  });

  it('handles a family with no members and no children', () => {
    expect(buildFamilyRoster([], [])).toEqual([]);
  });

  it('handles children with no accounts and accounts with no children', () => {
    expect(buildFamilyRoster([], children).map((e) => e.role)).toEqual(['child', 'child']);
    expect(buildFamilyRoster(members, []).map((e) => e.role)).toEqual(['owner', 'member']);
  });
});
