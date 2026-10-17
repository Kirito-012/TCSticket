import 'server-only'

import { dbConnect } from '@/server/db/connect'
import { RoleModel } from '@/server/db/models/role.model'
import { TicketModel } from '@/server/db/models/ticket.model'
import { TicketPriorityModel } from '@/server/db/models/ticket-priority.model'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { UserModel } from '@/server/db/models/user.model'
import { getRealSectors } from '@/server/sectors'
import type { TicketScope } from '@/lib/ticket-scope'
import {
  ZONES,
  prettySectorName,
  sectorKeyOf,
  sectorNoOf,
  zoneOfSectorKey,
  type ZoneKey,
} from '@/lib/zones'

const DAY_MS = 24 * 60 * 60 * 1000
const WAITING_DAYS = 3
const NAME_CACHE_MS = 10 * 60 * 1000

let nameCache: { at: number; names: Map<string, string> } | null = null

/**
 * Sector key -> how people say its name ("Bahadrabad"). The names live in the map database; if it
 * is slow or down the sectors are called "Sector 7" instead, so a dashboard never waits on it.
 */
export async function getSectorNames(): Promise<Map<string, string>> {
  if (nameCache && Date.now() - nameCache.at < NAME_CACHE_MS) return nameCache.names
  const fallback = new Map<string, string>(
    ZONES.flatMap((z) => z.sectorNos).map((n) => [sectorKeyOf(n), `Sector ${n}`]),
  )
  const rows = await Promise.race([
    getRealSectors(false).catch(() => []),
    new Promise<Awaited<ReturnType<typeof getRealSectors>>>((resolve) =>
      setTimeout(() => resolve([]), 4000),
    ),
  ])
  if (rows.length === 0) return fallback // not cached: try again next time
  const names = new Map(fallback)
  for (const row of rows) names.set(row.key, prettySectorName(row.name))
  nameCache = { at: Date.now(), names }
  return names
}

export type SurveyorSummary = { id: string; name: string; open: number; done: number }

export type SectorSummary = {
  key: string
  sectorNo: number
  name: string
  zoneKey: ZoneKey | null
  total: number
  open: number
  done: number
  /** Open tickets nobody has been given yet. */
  unassigned: number
  /** Open Critical / High tickets. */
  urgent: number
  /** Open tickets older than a few days. */
  waiting: number
  nodalManagers: string[]
  surveyors: SurveyorSummary[]
}

/** "BAHADRABAD-01 Surveyor" -> "BAHADRABAD-01": a person as the sector's field worker is called. */
function shortName(fullname: string) {
  return fullname.replace(/\s*(Zone Inspector|Surveyor|Nodal Manager)$/i, '').trim()
}

/**
 * One summary per sector the scope may see: how many tickets are open / done / waiting for
 * someone, and who looks after the sector. An Admin gets all 32, a Zone Inspector their zone's,
 * a Nodal Manager just their own.
 */
export async function getSectorSummaries(scope: TicketScope): Promise<SectorSummary[]> {
  if (scope.kind === 'own') return []
  await dbConnect()

  const allKeys = ZONES.flatMap((z) => z.sectorNos).map(sectorKeyOf)
  const keys = scope.kind === 'all' ? allKeys : allKeys.filter((k) => scope.sectorKeys.includes(k))
  if (keys.length === 0) return []

  const [names, resolvedStatuses, urgentPriorities, roles] = await Promise.all([
    getSectorNames(),
    TicketStatusModel.find({ isResolved: true }).select('_id').lean(),
    TicketPriorityModel.find({ slug: { $in: ['critical', 'high'] } })
      .select('_id')
      .lean(),
    RoleModel.find({ key: { $in: ['manager', 'agent'] } })
      .select('key')
      .lean(),
  ])
  const resolvedIds = resolvedStatuses.map((s) => s._id)
  const urgentIds = urgentPriorities.map((p) => p._id)
  const roleIdByKey = new Map(roles.map((r) => [r.key, r._id]))
  const waitingBefore = new Date(Date.now() - WAITING_DAYS * DAY_MS)

  const isOpen = { $not: [{ $in: ['$statusId', resolvedIds] }] }
  const [rows, people, perAssignee] = await Promise.all([
    TicketModel.aggregate([
      { $match: { deletedAt: null, sectorKey: { $in: keys } } },
      {
        $group: {
          _id: '$sectorKey',
          total: { $sum: 1 },
          open: { $sum: { $cond: [isOpen, 1, 0] } },
          unassigned: {
            $sum: { $cond: [{ $and: [isOpen, { $eq: ['$assigneeId', null] }] }, 1, 0] },
          },
          urgent: {
            $sum: { $cond: [{ $and: [isOpen, { $in: ['$priorityId', urgentIds] }] }, 1, 0] },
          },
          waiting: {
            $sum: { $cond: [{ $and: [isOpen, { $lt: ['$createdAt', waitingBefore] }] }, 1, 0] },
          },
        },
      },
    ]),
    UserModel.find({
      isActive: true,
      deletedAt: null,
      sectorKey: { $in: keys },
      roleId: { $in: [roleIdByKey.get('manager'), roleIdByKey.get('agent')].filter(Boolean) },
    })
      .select('fullname sectorKey roleId')
      .sort({ fullname: 1 })
      .lean(),
    TicketModel.aggregate([
      { $match: { deletedAt: null, sectorKey: { $in: keys }, assigneeId: { $ne: null } } },
      {
        $group: {
          _id: '$assigneeId',
          open: { $sum: { $cond: [isOpen, 1, 0] } },
          done: { $sum: { $cond: [isOpen, 0, 1] } },
        },
      },
    ]),
  ])

  const byKey = new Map(rows.map((r) => [r._id as string, r]))
  const counts = new Map(
    perAssignee.map((r) => [String(r._id), { open: r.open as number, done: r.done as number }]),
  )
  const managerRole = String(roleIdByKey.get('manager') ?? '')

  return keys.map((key) => {
    const row = byKey.get(key)
    const total = (row?.total as number | undefined) ?? 0
    const open = (row?.open as number | undefined) ?? 0
    const here = people.filter((p) => p.sectorKey === key)
    return {
      key,
      sectorNo: sectorNoOf(key) ?? 0,
      name: names.get(key) ?? key,
      zoneKey: zoneOfSectorKey(key)?.key ?? null,
      total,
      open,
      done: total - open,
      unassigned: (row?.unassigned as number | undefined) ?? 0,
      urgent: (row?.urgent as number | undefined) ?? 0,
      waiting: (row?.waiting as number | undefined) ?? 0,
      nodalManagers: here
        .filter((p) => String(p.roleId) === managerRole)
        .map((p) => shortName(p.fullname)),
      surveyors: here
        .filter((p) => String(p.roleId) !== managerRole)
        .map((p) => ({
          id: String(p._id),
          name: shortName(p.fullname),
          open: counts.get(String(p._id))?.open ?? 0,
          done: counts.get(String(p._id))?.done ?? 0,
        })),
    }
  })
}

export type ZoneSummary = {
  key: ZoneKey
  name: string
  sectorCount: number
  total: number
  open: number
  done: number
  unassigned: number
  urgent: number
  waiting: number
  inspectors: string[]
}

/** One summary per zone, for the Admin dashboard: totals of its sectors and who inspects it. */
export async function getZoneSummaries(): Promise<ZoneSummary[]> {
  await dbConnect()
  const [sectors, role] = await Promise.all([
    getSectorSummaries({ kind: 'all' }),
    RoleModel.findOne({ key: 'zoneinspector' }).select('_id').lean(),
  ])
  const inspectors = role
    ? await UserModel.find({
        roleId: role._id,
        isActive: true,
        deletedAt: null,
        zoneKey: { $ne: null },
      })
        .select('fullname zoneKey')
        .sort({ fullname: 1 })
        .lean()
    : []

  return ZONES.map((zone) => {
    const mine = sectors.filter((s) => s.zoneKey === zone.key)
    const sum = (pick: (s: SectorSummary) => number) => mine.reduce((n, s) => n + pick(s), 0)
    return {
      key: zone.key,
      name: zone.name,
      sectorCount: zone.sectorNos.length,
      total: sum((s) => s.total),
      open: sum((s) => s.open),
      done: sum((s) => s.done),
      unassigned: sum((s) => s.unassigned),
      urgent: sum((s) => s.urgent),
      waiting: sum((s) => s.waiting),
      inspectors: inspectors
        .filter((u) => u.zoneKey === zone.key)
        .map((u) => shortName(u.fullname)),
    }
  })
}

/** The sectors a person may pick in a filter: their scope's sectors, named, in zone order. */
export async function getSectorOptions(
  scope: TicketScope,
): Promise<{ value: string; label: string; zone: string }[]> {
  if (scope.kind === 'own') return []
  const names = await getSectorNames()
  return ZONES.flatMap((zone) =>
    zone.sectorNos
      .map(sectorKeyOf)
      .filter((key) => scope.kind === 'all' || scope.sectorKeys.includes(key))
      .map((key) => ({ value: key, label: names.get(key) ?? key, zone: zone.name })),
  )
}

/** Every sector for a picker: value is the sector number, label reads "Zone 2 · Kankhal". */
export async function getSectorChoices(): Promise<{ value: string; label: string }[]> {
  const names = await getSectorNames()
  return ZONES.flatMap((zone) =>
    zone.sectorNos.map((no) => ({
      value: String(no),
      label: `${zone.name} · ${names.get(sectorKeyOf(no)) ?? `Sector ${no}`}`,
    })),
  )
}
