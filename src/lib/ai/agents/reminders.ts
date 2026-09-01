// Agent 3 — Smart reminders.
//
// Suggestions are proposals only: the UI asks the user to confirm before any
// `event_reminders` row is written.

export const REMINDER_AGENT_NAME = 'reminders';

export const reminderInstruction = `## Task 3 — reminders
Suggest between 0 and 3 reminders, as whole minutes before the event starts.

Match the lead time to the category: matches and performances usually need
preparation and travel (e.g. 1 day and 2 hours before); doctor appointments a
day and an hour before; school events a day before; birthdays several days
before so a present can be bought. An all-day event with no start time should
get day-scale reminders, never minute-scale ones.

Give each one a short human label in the user's language. Suggest nothing at
all rather than padding the list with reminders that add no value.`;
