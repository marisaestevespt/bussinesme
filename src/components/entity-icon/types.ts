export type EntityIcon =
  | { type: "emoji"; value: string }
  | { type: "image"; value: string }
  | null;

export function parseIcon(raw: unknown): EntityIcon {
  if (!raw) return null;
  if (typeof raw === "string") {
    // Legacy: stored as plain URL string
    if (raw.startsWith("http")) return { type: "image", value: raw };
    return { type: "emoji", value: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as { type?: string; value?: string };
    if ((obj.type === "emoji" || obj.type === "image") && typeof obj.value === "string" && obj.value) {
      return { type: obj.type, value: obj.value };
    }
  }
  return null;
}