/**
 * Copies the DroneSeva tickets (the ones that came with a drone photo) from one database to another
 * on the same MongoDB cluster, together with what they refer to, so the new database works on its own.
 *
 *   node --env-file=.env.local --import tsx scripts/copy-drone-tickets.ts --from KumbhMela --to nigam
 *   node --env-file=.env.local --import tsx scripts/copy-drone-tickets.ts --from KumbhMela --to nigam --apply
 *
 * The first form only shows what it would copy. It reads the cluster address from MONGODB_URI and
 * swaps in the database names, so no password is ever typed here.
 *
 * What is copied:
 *  - roles, statuses, priorities, ticket types, tags, accounts and the ticket counter, whole (the
 *    tickets point at them by id, so they keep the same ids and everyone keeps their password);
 *  - the DroneSeva tickets (source "api", not deleted, with a drone photo), and their history,
 *    comments, attachments and questionnaires.
 *
 * Safety: the source is only read. The target must be empty, or nothing is written.
 */
import mongoose from 'mongoose'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const FROM = arg('from')
const TO = arg('to')
const APPLY = process.argv.includes('--apply')

const WHOLE = [
  'roles',
  'ticketstatuses',
  'ticketpriorities',
  'tickettypes',
  'tags',
  'users',
  'counters',
]
const BY_TICKET = ['ticketevents', 'ticketcomments', 'ticketattachments', 'ticketquestionnaires']
const DRONE_TICKETS = { source: 'api', deletedAt: null, 'sourcePhotos.0': { $exists: true } }

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (!FROM || !TO) throw new Error('Give --from <database> and --to <database>')
  if (FROM === TO) throw new Error('--from and --to must be different databases')

  console.log(APPLY ? 'APPLYING.\n' : 'PREVIEW only — nothing is written. Add --apply to do it.\n')
  const open = (dbName: string) => mongoose.createConnection(uri, { dbName }).asPromise()
  const [source, target] = await Promise.all([open(FROM), open(TO)])
  const from = source.db!
  const to = target.db!

  // The target must be empty: never mix into a database that already has data.
  const existing = await to.listCollections().toArray()
  let occupied = 0
  for (const { name } of existing) occupied += await to.collection(name).countDocuments()
  if (occupied > 0) {
    throw new Error(`"${TO}" already has ${occupied} documents; refusing to write into it.`)
  }

  const plan: { name: string; docs: Record<string, unknown>[] }[] = []
  for (const name of WHOLE)
    plan.push({ name, docs: await from.collection(name).find({}).toArray() })

  const tickets = await from.collection('tickets').find(DRONE_TICKETS).toArray()
  plan.push({ name: 'tickets', docs: tickets })
  const ids = tickets.map((t) => t._id)
  for (const name of BY_TICKET) {
    plan.push({
      name,
      docs: await from
        .collection(name)
        .find({ ticketId: { $in: ids } })
        .toArray(),
    })
  }

  // Everything a ticket points at must be copied too, or the new database would have gaps.
  const known = (name: string) =>
    new Set(plan.find((p) => p.name === name)!.docs.map((d) => String(d._id)))
  const users = known('users')
  const statuses = known('ticketstatuses')
  const priorities = known('ticketpriorities')
  const types = known('tickettypes')
  const missing = tickets.filter(
    (t) =>
      !users.has(String(t.ownerId)) ||
      (t.assigneeId && !users.has(String(t.assigneeId))) ||
      !statuses.has(String(t.statusId)) ||
      !priorities.has(String(t.priorityId)) ||
      !types.has(String(t.typeId)),
  )
  if (missing.length > 0)
    throw new Error(`${missing.length} tickets point at something that is not being copied`)

  const counter = plan.find((p) => p.name === 'counters')!.docs.find((d) => d._id === 'tickets')
  const highest = Math.max(...tickets.map((t) => Number(t.number)))
  if (counter && Number(counter.seq) < highest)
    throw new Error('The ticket counter is behind the tickets')

  console.log(`From "${FROM}" to "${TO}":`)
  for (const { name, docs } of plan) console.log(`  ${name.padEnd(22)} ${docs.length}`)
  console.log(
    `\n${tickets.length} DroneSeva tickets (numbers ${Math.min(...tickets.map((t) => Number(t.number)))}..${highest}); the counter continues from ${counter?.seq}.`,
  )

  if (APPLY) {
    for (const { name, docs } of plan) {
      if (docs.length === 0) continue
      await to.collection(name).insertMany(docs, { ordered: true })
    }
    for (const { name, docs } of plan) {
      const now = await to.collection(name).countDocuments()
      if (now !== docs.length) throw new Error(`${name}: expected ${docs.length}, found ${now}`)
    }
    console.log('\nDone. Every collection was checked after copying.')
  } else {
    console.log('\nPreview finished. Nothing was changed.')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('\nStopped:', err.message)
  process.exit(1)
})
