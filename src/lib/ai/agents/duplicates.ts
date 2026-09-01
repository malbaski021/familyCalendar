// Agent 1 — Duplicate Detection.
//
// Candidates are pre-filtered in SQL to a narrow date window, so this agent
// only judges semantic similarity; it is not asked to scan the calendar.

export const DUPLICATE_AGENT_NAME = 'duplicates';

export const duplicateInstruction = `## Task 1 — duplicates
Decide whether the new event is the same real-world event as one of the
candidates listed under "Existing events".

Treat as duplicates: the same activity at the same time written differently
("Luka football" vs "Fudbal trening Luka"), or an obvious re-entry of the same
appointment. Do NOT treat a recurring activity's separate occurrences on
different dates as duplicates, and do not merge two different children's
events just because the activity matches.

Set "matchEventId" to the id of the matching candidate, or null. Only ever use
an id that appears in the candidate list. If there are no candidates, answer
isDuplicate=false with matchEventId=null and confidence 0.`;
