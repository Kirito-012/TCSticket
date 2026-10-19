import { makeTranslate, type Translate } from '../i18n/config'

/**
 * The text of a ticket is written once, in English, by DroneSeva when it makes the ticket. Each
 * person reads it in their own language, so the sentences DroneSeva is known to write are put
 * into the chosen language here, when the ticket is shown. Anything this does not recognise (a
 * note someone typed, for instance) is left exactly as it was.
 *
 * Only plain wording around the numbers and names is translated; names, numbers and links stay.
 */
export function localizeIssueHtml(html: string, t: Translate = makeTranslate({})): string {
  let out = html

  // "Garbage detection found <strong>12</strong> items in project "North field"."
  out = out.replace(
    /Garbage detection found <strong>(\d+)<\/strong> item(s?) in project "([^"]*)"\./g,
    (_m, count: string, plural: string, project: string) =>
      t(
        plural
          ? 'Garbage detection found {count} items in project "{project}".'
          : 'Garbage detection found {count} item in project "{project}".',
        { count: `<strong>${count}</strong>`, project },
      ),
  )

  // "...found <strong>5</strong> items at spot 2 of the drone video "Flight 3" (seen 1:05 into the video)."
  out = out.replace(
    /Garbage detection found <strong>(\d+)<\/strong> item(s?) at spot (\d+) of the drone video "([^"]*)" \(seen ([\d:]+) into the video\)\./g,
    (_m, count: string, plural: string, spot: string, video: string, time: string) =>
      t(
        plural
          ? 'Garbage detection found {count} items at spot {spot} of the drone video "{video}" (seen {time} into the video).'
          : 'Garbage detection found {count} item at spot {spot} of the drone video "{video}" (seen {time} into the video).',
        { count: `<strong>${count}</strong>`, spot, video, time },
      ),
  )

  // "<strong>Mostly:</strong> Plastic packaging (4), Pallets (2)": the kinds are translated too.
  out = out.replace(
    /<strong>Mostly:<\/strong>\s*([^<]*)/g,
    (_m, list: string) =>
      `<strong>${t('Mostly:')}</strong> ${list
        .split(', ')
        .map((entry) => {
          const kind = /^(.*?)( \(\d+\))?$/.exec(entry.trim())
          return kind ? `${t(kind[1])}${kind[2] ?? ''}` : entry
        })
        .join(', ')}`,
  )

  out = out.replace(/<strong>Location:<\/strong>/g, `<strong>${t('Location:')}</strong>`)
  out = out.replace(/\((\d+) detected locations?\)/g, (_m, n: string) =>
    t(n === '1' ? '({count} detected location)' : '({count} detected locations)', { count: n }),
  )
  out = out.replace(
    /GPS coordinates are not available for this analysis\./g,
    t('GPS coordinates are not available for this analysis.'),
  )
  out = out.replace(/>Open location in Google Maps</g, `>${t('Open location in Google Maps')}<`)
  out = out.replace(/>View in DroneSeva</g, `>${t('View in DroneSeva')}<`)
  return out
}
