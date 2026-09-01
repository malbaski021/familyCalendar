// Agent 2 — Categorisation & child tagging.
//
// The family's children are supplied with their ids so the model can tag
// directly. Names it spots that are not on the list come back separately, so
// the UI can offer "add this child to the family?" instead of silently
// inventing a child.

export const CATEGORIZATION_AGENT_NAME = 'categorization';

export const categorizationInstruction = `## Task 2 — category and children
Pick the single best "category" for the event from exactly these values:
birthday, performance, match, school, doctor, other.

Guidance: "match" is a competitive fixture or game; "performance" is a recital,
show or concert; "school" covers classes, parent meetings and school trips;
"doctor" covers medical and dental appointments; "birthday" covers parties and
birthdays; "other" is the fallback — use it rather than forcing a bad fit.

Then decide which of the family's children the event is about:
- "childIds": ids from the "Family children" list only. Empty array if the
  event is not about a specific child.
- "newChildNames": personal names that clearly refer to a child taking part but
  which are NOT in the family list. Leave empty unless you are confident it is
  a child's name — do not put coaches, teachers, doctors, places or teams here.

Names may appear in Serbian or English, in any case, and may be inflected
(e.g. "Luki", "Lukin" all refer to "Luka"). Match them to the listed child.`;
