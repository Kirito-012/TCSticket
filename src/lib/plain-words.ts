/**
 * Plain-language wording for the Surveyor screens. The full app keeps its ticketing terms
 * (New / Open / Pending / Resolved, priorities); inspectors only ever see "To do" and "Done",
 * and "Urgent" when something really is.
 */

type StatusLike = { slug?: string | null; isResolved?: boolean | null } | null | undefined
type PriorityLike = { slug?: string | null } | null | undefined

export function isDone(status: StatusLike) {
  return Boolean(status?.isResolved) || status?.slug === 'resolved' || status?.slug === 'closed'
}

export function plainStatusLabel(status: StatusLike) {
  return isDone(status) ? 'Done' : 'To do'
}

export function isUrgent(priority: PriorityLike) {
  return priority?.slug === 'critical' || priority?.slug === 'high'
}

/** "Garbage detected — Ward 5" reads as a system message; say what the person has to do. */
export function plainTitle(subject: string) {
  return subject.replace(/^Garbage detected\s*(?:—|-)\s*/i, 'Clean up: ')
}

/**
 * Everyday names for the five ticket statuses, for Admin/Manager screens. The underlying
 * statuses are unchanged; only what people read on the screen.
 */
const FRIENDLY_STATUS: Record<string, string> = {
  new: 'New',
  open: 'In progress',
  pending: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function friendlyStatusName(name: string) {
  return FRIENDLY_STATUS[name.trim().toLowerCase()] ?? name
}

/** "BAHADRABAD-01 Surveyor" -> "BAHADRABAD-01": a name without the role it was saved with. */
export function personShortName(fullname: string): string {
  return fullname.replace(/\s*(Zone Inspector|Surveyor|Nodal Manager)$/i, '').trim()
}
