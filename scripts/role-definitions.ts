/**
 * The four roles and what each may do. Shared by the seed (a fresh database) and by
 * migrate-roles.ts (the live one), so the two can never drift apart.
 *
 *   Admin          sees everything                       ticket:read:all
 *   Zone Inspector sees the tickets of one zone          ticket:read:zone   (user.zoneKey)
 *   Nodal Manager  sees the tickets of one sector        ticket:read:sector (user.sectorKey)
 *   Surveyor       sees only the tickets given to them   ticket:read:own
 *
 * The keys 'manager' (Nodal Manager) and 'agent' (Surveyor) are kept as they were, so existing
 * accounts and code keep working; only their names and what they may see changed.
 */

export const ALL_GRANTS = [
  'ticket:read:own',
  'ticket:read:group',
  'ticket:read:all',
  'ticket:read:zone',
  'ticket:read:sector',
  'ticket:create',
  'ticket:update',
  'ticket:delete',
  'ticket:assign',
  'ticket:merge',
  'comment:create',
  'comment:update:own',
  'comment:update:any',
  'comment:delete',
  'note:read',
  'note:create',
  'attachment:create',
  'attachment:delete',
  'account:read',
  'account:create',
  'account:update',
  'account:delete',
  'group:manage',
  'team:manage',
  'department:manage',
  'report:view',
  'report:generate',
  'notice:manage',
  'settings:manage',
  'role:manage',
]

/** What a Zone Inspector or Nodal Manager may do inside their own area. They do not manage accounts. */
const AREA_LEAD_GRANTS = [
  'ticket:create',
  'ticket:update',
  'ticket:assign',
  'ticket:merge',
  'comment:create',
  'comment:update:own',
  'comment:update:any',
  'note:read',
  'note:create',
  'attachment:create',
  'report:view',
  'report:generate',
]

export const ROLES = [
  { key: 'admin', name: 'Admin', rank: 0, isSystem: true, grants: ALL_GRANTS },
  {
    key: 'zoneinspector',
    name: 'Zone Inspector',
    rank: 1,
    isSystem: true,
    grants: ['ticket:read:zone', ...AREA_LEAD_GRANTS],
  },
  {
    key: 'manager',
    name: 'Nodal Manager',
    rank: 2,
    isSystem: true,
    grants: ['ticket:read:sector', ...AREA_LEAD_GRANTS],
  },
  {
    key: 'agent',
    name: 'Surveyor',
    rank: 3,
    isSystem: true,
    // 'own' — a Surveyor's ticket list and dashboard are scoped server-side to the tickets given to
    // them (see requireTicketScope() in src/server/auth/session.ts). ticket:assign is NOT granted.
    grants: [
      'ticket:read:own',
      'ticket:create',
      'ticket:update',
      'comment:create',
      'comment:update:own',
      'note:read',
      'note:create',
      'attachment:create',
      'report:view',
    ],
  },
] as const
