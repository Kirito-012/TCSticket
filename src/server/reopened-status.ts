/**
 * The "Reopened" ticket status: a finished ticket whose place was flown over again and still showed
 * garbage. It counts as unfinished work (isResolved: false), so it comes back to the Surveyor's
 * "To do" list. Used by the seed script and, so no manual step is needed, by the re-check itself.
 */
export const REOPENED_STATUS = {
  name: 'Reopened',
  slug: 'reopened',
  color: '#ef4444',
  order: 1.5,
  isResolved: false,
  isDefault: false,
}
