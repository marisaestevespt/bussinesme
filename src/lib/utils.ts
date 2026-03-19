import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Statuses that should be excluded from financial calculations */
const CANCELLED_STATUSES = ['cancelado', 'cancelada'];

/** Filter out cancelled records from financial calculations */
export function excludeCancelled<T extends { status: string }>(items: T[]): T[] {
  return items.filter(i => !CANCELLED_STATUSES.includes(i.status));
}
