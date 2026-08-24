// Matches kumbh.sector_plan.class_group buckets produced by the loader
// (Dashboard/scripts/load_kumbh.py) — top classes get their own colour,
// the long tail is bucketed into "Other".
export const CLASS_GROUP_COLORS: Record<string, string> = {
  'Religious Camping': '#e07b39',
  Parking: '#6b7280',
  'Police Camping': '#1d4ed8',
  'Reserved Area': '#a78bfa',
  'Administrative Camping': '#059669',
  Commercial: '#db2777',
  Amenities: '#f59e0b',
  'Health Camping': '#ef4444',
  Road: '#78716c',
  'Existing Development': '#0ea5e9',
  Other: '#cbd5e1',
}

export const ROAD_TYPE_COLORS: Record<string, string> = {
  'Existing Road': '#374151',
  'Proposed Road': '#2563eb',
  'Emergency Exit': '#dc2626',
}

export const ROAD_TYPE_DASH: Record<string, [number, number] | undefined> = {
  'Existing Road': undefined,
  'Proposed Road': [2, 2],
  'Emergency Exit': [1, 1],
}
