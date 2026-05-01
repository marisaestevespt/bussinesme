/**
 * URL sanitization to prevent XSS via javascript:, data:, vbscript: protocols.
 * Use whenever rendering user-supplied URLs in href/src attributes.
 */

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

/**
 * Returns a safe URL string or "#" if the input is unsafe/invalid.
 * Allows: http(s), mailto, tel, and relative paths (starting with / or #).
 * Blocks: javascript:, data:, vbscript:, file:, and other dangerous schemes.
 */
export function safeUrl(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "#";
  const trimmed = input.trim();
  if (!trimmed) return "#";

  // Allow relative paths and anchors
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) {
    return trimmed;
  }

  // Try to parse as absolute URL; if no protocol, prepend https://
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Probably a domain like "example.com" — treat as https
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return "#";
    }
  }

  if (!SAFE_PROTOCOLS.includes(url.protocol.toLowerCase())) {
    return "#";
  }

  return url.toString();
}