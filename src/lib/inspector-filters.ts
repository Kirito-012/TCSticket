/**
 * The filters a Surveyor can put on their ticket list, and how they travel in the address
 * (so a filtered list survives a refresh and the Back button). Plain data only — safe to import
 * from both server and client code.
 */

export type InspectorSort = 'urgent' | 'newest' | 'oldest'
export type InspectorWhen = 'any' | 'today' | 'week' | 'month'
export type InspectorShow = 'todo' | 'done'
/** On the Done list: every ticket, only the checked ones ('yes'), or only the not-yet-checked ('no'). */
export type InspectorVerified = 'any' | 'yes' | 'no'

/** What an inspector can narrow their list by. The defaults show everything, urgent first. */
export type InspectorFilters = {
  sort: InspectorSort
  /** When the ticket arrived. */
  when: InspectorWhen
  /** One exact day, YYYY-MM-DD (wins over `when`). */
  on: string
  urgentOnly: boolean
  /** Finished tickets only: whether the cleanup has been checked. */
  verified: InspectorVerified
  /** Only tickets that were reopened after the drone re-check. */
  reopenedOnly: boolean
}

export const DEFAULT_INSPECTOR_FILTERS: InspectorFilters = {
  sort: 'urgent',
  when: 'any',
  on: '',
  urgentOnly: false,
  verified: 'any',
  reopenedOnly: false,
}

const SORTS: InspectorSort[] = ['urgent', 'newest', 'oldest']
const WHENS: InspectorWhen[] = ['any', 'today', 'week', 'month']

/** Reads the filters from the page's address. Anything unrecognised falls back to the default. */
export function parseInspectorFilters(get: (key: string) => string | undefined): InspectorFilters {
  const on = get('on') ?? ''
  return {
    sort: SORTS.find((s) => s === get('sort')) ?? 'urgent',
    when: WHENS.find((w) => w === get('when')) ?? 'any',
    on: /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : '',
    urgentOnly: get('urgent') === '1',
    verified: get('verified') === 'yes' ? 'yes' : get('verified') === 'no' ? 'no' : 'any',
    reopenedOnly: get('reopened') === '1',
  }
}

/** The address for a list: only settings that differ from the defaults appear in it. */
export function inspectorHref(show: InspectorShow, filters: InspectorFilters) {
  const params = new URLSearchParams()
  if (show === 'done') params.set('show', 'done')
  if (filters.sort !== 'urgent') params.set('sort', filters.sort)
  if (filters.on) params.set('on', filters.on)
  else if (filters.when !== 'any') params.set('when', filters.when)
  if (filters.urgentOnly) params.set('urgent', '1')
  if (filters.verified !== 'any') params.set('verified', filters.verified)
  if (filters.reopenedOnly) params.set('reopened', '1')
  const qs = params.toString()
  return qs ? `/tickets?${qs}` : '/tickets'
}

/** How many settings differ from the defaults (shown as a badge on the Filter button). */
export function activeFilterCount(filters: InspectorFilters) {
  return (
    Number(filters.sort !== 'urgent') +
    Number(filters.when !== 'any' || filters.on !== '') +
    Number(filters.urgentOnly) +
    Number(filters.verified !== 'any') +
    Number(filters.reopenedOnly)
  )
}
