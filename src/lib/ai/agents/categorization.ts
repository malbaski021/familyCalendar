// Agent 2 — Categorisation & child tagging.
//
// The family's children are supplied with their ids so the model can tag
// directly. It is deliberately not asked about names outside that list: an
// unknown name is left untagged rather than offered as a new family member.
// `parseSuggestions` also drops any id we did not send, so a hallucinated
// child cannot reach the UI even if the model volunteers one.

export const CATEGORIZATION_AGENT_NAME = 'categorization';

export const categorizationInstruction = `## Task 2 — category and children
Pick the single best "category" for the event from exactly these values:
birthday, performance, match, school, doctor, other.

Guidance:
- "match" — any sporting or physical activity: fixtures and games, but equally
  training sessions, practice, and regular club activities. There is no
  separate sports category, so "Luka football Saturday" and "fudbal trening"
  are both "match".
- "performance" — recitals, shows, concerts, and their rehearsals.
- "school" — classes, parent meetings, exams and school trips.
- "doctor" — medical and dental appointments, check-ups, vaccinations.
- "birthday" — birthdays and parties.
- "other" — genuine fallback only. Do not reach for it when one of the
  categories above plausibly fits.

Then decide which of the family's children the event is about:
- "childIds": ids from the "Family children" list only. Empty array if the
  event is not about a specific child. Never invent an id, and do not report
  names that are absent from that list — an unknown name is simply not tagged.

Names may appear in Serbian or English, in any case, and may be inflected
(e.g. "Luki", "Lukin" all refer to "Luka"). Match them to the listed child.`;
