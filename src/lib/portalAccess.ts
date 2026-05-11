const PORTAL_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PUBLIC_PORTAL_KEYS = [
  'id',
  'token',
  'is_active',
  'client_id',
  'show_onboarding',
  'show_timeline',
  'show_payments',
  'show_meetings',
  'show_faqs',
  'show_monthly_summary',
  'show_workspace',
  'portal_type',
  'slug',
  'playlist_url',
] as const;

export type PublicPortalKey = (typeof PUBLIC_PORTAL_KEYS)[number];

export interface PublicPortal {
  id: string;
  token: string;
  is_active: boolean;
  client_id: string;
  show_onboarding?: boolean;
  show_timeline?: boolean;
  show_payments?: boolean;
  show_meetings?: boolean;
  show_faqs?: boolean;
  show_monthly_summary?: boolean;
  show_workspace?: boolean;
  portal_type?: string | null;
  slug?: string | null;
  playlist_url?: string | null;
}

type RpcCaller = (fn: 'get_portal_by_slug' | 'get_portal_by_token', args: Record<string, string>) => Promise<{ data: unknown }>;

const hasDefinedValue = (obj: Record<string, unknown>, key: PublicPortalKey) =>
  Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null;

const pickDefinedPortalField = (
  primary: Record<string, unknown>,
  fallback: Record<string, unknown>,
  key: PublicPortalKey,
) => (hasDefinedValue(primary, key) ? primary[key] : fallback[key]);

export function isPortalUuid(value: string | undefined | null) {
  return !!value && PORTAL_UUID_REGEX.test(value);
}

export function asPortalRow(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
}

export function hasCompletePortalAccess(row: Record<string, unknown> | null | undefined) {
  if (!row) return false;
  return PUBLIC_PORTAL_KEYS.every((key) => hasDefinedValue(row, key));
}

export function mergePortalAccessRows(
  primary: Record<string, unknown> | null | undefined,
  fallback: Record<string, unknown> | null | undefined,
) {
  if (!primary && !fallback) return null;
  const primaryRow = primary ?? {};
  const fallbackRow = fallback ?? {};

  return PUBLIC_PORTAL_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    const value = pickDefinedPortalField(primaryRow, fallbackRow, key);
    if (value !== undefined && value !== null) acc[key] = value;
    return acc;
  }, {});
}

export async function resolvePublicPortal(identifier: string, rpc: RpcCaller): Promise<PublicPortal | null> {
  if (!identifier) return null;

  if (isPortalUuid(identifier)) {
    const tokenRow = asPortalRow((await rpc('get_portal_by_token', { _token: identifier })).data);
    if (!tokenRow) return null;
    return { ...(tokenRow as Record<string, unknown>), token: identifier } as PublicPortal;
  }

  const slugRow = asPortalRow((await rpc('get_portal_by_slug', { _slug: identifier })).data);
  if (!slugRow) return null;

  const baseSlugRow = { ...slugRow, slug: (slugRow.slug as string | undefined) ?? identifier };
  if (hasCompletePortalAccess(baseSlugRow)) {
    return baseSlugRow as PublicPortal;
  }

  const token = typeof slugRow.token === 'string' ? slugRow.token : null;
  if (!token) {
    return baseSlugRow as PublicPortal;
  }

  const tokenRow = asPortalRow((await rpc('get_portal_by_token', { _token: token })).data);
  const merged = mergePortalAccessRows(baseSlugRow, tokenRow ? { ...tokenRow, token } : null);
  return (merged ?? baseSlugRow) as PublicPortal;
}