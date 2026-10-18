/** Relations returned with a case so clients get everything in one round-trip. */
export const FULL_CASE_POPULATE = {
  parties: true,
  hearings: true,
  orders: true,
  documents: true,
  notes: true,
  deadlines: true,
  members: true,
  owner: true,
  invites: true,
} as const;
