import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert empty strings to null in a payload object */
export function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])
  ) as T;
}

/** cleanPayload + strip timestamp keys (created_at, updated_at) */
export function cleanPayloadStrip<T extends Record<string, unknown>>(obj: T): T {
  const STRIP = ['created_at', 'updated_at'];
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !STRIP.includes(k))
      .map(([k, v]) => [k, v === '' ? null : v])
  ) as T;
}

/** Statuses that should be excluded from financial calculations */
const CANCELLED_STATUSES = ['cancelado', 'cancelada'];

/** Filter out cancelled records from financial calculations */
export function excludeCancelled<T extends { status: string }>(items: T[]): T[] {
  return items.filter(i => !CANCELLED_STATUSES.includes(i.status));
}
