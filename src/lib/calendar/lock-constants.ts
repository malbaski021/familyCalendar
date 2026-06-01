// Constants used by both the lock / draft server actions and the edit-shell
// client component. Lives outside the `'use server'` files so it doesn't
// violate Next.js's "only async exports" rule for action modules.

/**
 * How long a lock stays valid without a heartbeat. The edit shell refreshes
 * the lock every 5 minutes; if a holder closes the editor or loses
 * connectivity, the lock implicitly times out after this much idle time and
 * another family member can take over.
 */
export const LOCK_TTL_MS = 15 * 60 * 1000;

/** Drafts stay around for a day after their last save before the cron sweeps them. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
