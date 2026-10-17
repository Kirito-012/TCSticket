'use client'

import { useTransition } from 'react'
import {
  updateUserRoleAction,
  updateUserPlacementAction,
  setUserActiveAction,
} from '@/server/actions/account.actions'
import type { SectorChoice } from '@/components/accounts/PlacementField'
import { placementKindOf, ZONE_OPTIONS } from '@/lib/placement'
import { sectorNoOf } from '@/lib/zones'
import { cn, initialsFor, timeAgo } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Select'

export type AccountRow = {
  id: string
  fullname: string
  email: string
  roleId: string
  roleKey: string
  roleName: string
  /** Where the person works: a sector ('kumbh-sector-7') or, for a Zone Inspector, a zone ('zone-2'). */
  sectorKey: string | null
  zoneKey: string | null
  isActive: boolean
  createdAt: string
}

export type RoleOption = { id: string; name: string }

/** Where a person works, as plain text or — for an Admin — a picker to move them. */
function AreaCell({
  user,
  sectors,
  editable,
  disabled,
  onChange,
}: {
  user: AccountRow
  sectors: SectorChoice[]
  editable: boolean
  disabled: boolean
  onChange: (userId: string, value: string) => void
}) {
  const kind = placementKindOf(user.roleKey)
  if (kind === null) return <span className="text-xs text-muted">—</span>

  const options = kind === 'sector' ? sectors : ZONE_OPTIONS
  const value = kind === 'sector' ? String(sectorNoOf(user.sectorKey) ?? '') : (user.zoneKey ?? '')
  const label = options.find((o) => o.value === value)?.label

  if (!editable) {
    return label ? (
      <span className="text-xs font-medium text-muted-strong">{label}</span>
    ) : (
      <span className="text-xs font-medium text-warning">Not placed yet</span>
    )
  }
  return (
    <div className="w-48">
      <Select
        value={value}
        disabled={disabled}
        onChange={(next) => onChange(user.id, next)}
        size="sm"
        placeholder={kind === 'sector' ? 'Choose a sector' : 'Choose a zone'}
        options={options}
      />
    </div>
  )
}

export const ROLE_COLOR: Record<string, string> = {
  Admin: '#818cf8',
  'Nodal Manager': '#f59e0b',
  Surveyor: '#10b981',
  'Zone Inspector': '#10b981',
}

export function AccountsTable({
  users,
  roles,
  sectors,
  canEdit,
  canEditRole,
}: {
  users: AccountRow[]
  roles: RoleOption[]
  sectors: SectorChoice[]
  canEdit: boolean
  canEditRole: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handlePlacementChange(userId: string, value: string) {
    const user = users.find((u) => u.id === userId)
    const kind = user ? placementKindOf(user.roleKey) : null
    startTransition(() =>
      updateUserPlacementAction(userId, kind === 'zone' ? { zoneKey: value } : { sectorNo: value }),
    )
  }

  function handleRoleChange(userId: string, roleId: string) {
    startTransition(() => updateUserRoleAction(userId, roleId))
  }

  function handleToggleActive(userId: string, next: boolean) {
    startTransition(() => setUserActiveAction(userId, next))
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No accounts yet</p>
      </div>
    )
  }

  return (
    <>
      {/* Phones and tablets: one card per account instead of a wide table. */}
      <ul className="divide-y divide-border lg:hidden">
        {users.map((u) => (
          <li key={u.id} className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Avatar
                person={{
                  name: u.fullname,
                  initials: initialsFor(u.fullname),
                  color: ROLE_COLOR[u.roleName] ?? '#3f3f46',
                }}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground [overflow-wrap:anywhere]">{u.fullname}</p>
                <p className="text-xs text-muted [overflow-wrap:anywhere]">{u.email}</p>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium',
                  u.isActive ? 'text-accent-strong' : 'text-muted',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    u.isActive ? 'bg-accent-strong' : 'bg-muted',
                  )}
                />
                {u.isActive ? 'Active' : 'Deactivated'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canEditRole ? (
                <div className="w-full sm:w-44">
                  <Select
                    value={u.roleId}
                    disabled={pending}
                    onChange={(roleId) => handleRoleChange(u.id, roleId)}
                    size="sm"
                    options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  />
                </div>
              ) : (
                <span className="text-xs font-medium text-muted-strong">{u.roleName}</span>
              )}
              <AreaCell
                user={u}
                sectors={sectors}
                editable={canEditRole}
                disabled={pending}
                onChange={handlePlacementChange}
              />
              <span className="text-xs text-muted">Joined {timeAgo(u.createdAt)}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleToggleActive(u.id, !u.isActive)}
                  className="ml-auto cursor-pointer text-xs font-medium text-muted-strong transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {u.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Area</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              {canEdit && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      person={{
                        name: u.fullname,
                        initials: initialsFor(u.fullname),
                        color: ROLE_COLOR[u.roleName] ?? '#3f3f46',
                      }}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{u.fullname}</p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  {canEditRole ? (
                    <div className="w-32">
                      <Select
                        value={u.roleId}
                        disabled={pending}
                        onChange={(roleId) => handleRoleChange(u.id, roleId)}
                        size="sm"
                        options={roles.map((r) => ({ value: r.id, label: r.name }))}
                      />
                    </div>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${ROLE_COLOR[u.roleName] ?? '#3f3f46'}22`,
                        color: ROLE_COLOR[u.roleName] ?? '#9aa1ac',
                      }}
                    >
                      {u.roleName}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <AreaCell
                    user={u}
                    sectors={sectors}
                    editable={canEditRole}
                    disabled={pending}
                    onChange={handlePlacementChange}
                  />
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium',
                      u.isActive ? 'text-accent-strong' : 'text-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        u.isActive ? 'bg-accent-strong' : 'bg-muted',
                      )}
                    />
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-xs text-muted">{timeAgo(u.createdAt)}</td>
                {canEdit && (
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleToggleActive(u.id, !u.isActive)}
                      className="cursor-pointer text-xs font-medium text-muted-strong transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
