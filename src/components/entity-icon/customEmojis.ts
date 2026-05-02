/**
 * Custom emojis injected into @emoji-mart picker.
 *
 * Why: @emoji-mart/data hasn't shipped Unicode 16 yet (last release: Apr 2024),
 * so newer emojis like the Lyre 🪉 are missing from the default dataset.
 * We expose them as a "Lyrata" custom category at the top of the picker.
 *
 * Format: https://github.com/missive/emoji-mart#custom-data
 * Each emoji uses the native unicode glyph as a single skin entry. Modern
 * browsers / OS fonts render Unicode 16 glyphs even when the dataset doesn't
 * carry their metadata.
 */
export const CUSTOM_EMOJI_CATEGORIES = [
  {
    id: "lirah",
    name: "Lyrata ✨",
    emojis: [
      // Unicode 16.0 (Sept 2024)
      { id: "lyre", name: "Lyre", keywords: ["lira", "lyre", "music", "lirah", "harp"], skins: [{ native: "🪉" }] },
      { id: "harp", name: "Harp", keywords: ["harpa", "harp", "music"], skins: [{ native: "🎵" }] },
      { id: "shovel", name: "Shovel", keywords: ["pa", "shovel", "dig"], skins: [{ native: "🪏" }] },
      { id: "splatter", name: "Splatter", keywords: ["splat", "stain", "salpico"], skins: [{ native: "🫟" }] },
      { id: "fingerprint", name: "Fingerprint", keywords: ["impressao", "digital", "fingerprint"], skins: [{ native: "🫆" }] },
      { id: "leafless-tree", name: "Leafless Tree", keywords: ["arvore", "tree", "winter"], skins: [{ native: "🪾" }] },
      { id: "root-vegetable", name: "Root Vegetable", keywords: ["raiz", "root", "vegetable"], skins: [{ native: "🫜" }] },
      { id: "face-with-bags-under-eyes", name: "Tired Face", keywords: ["cansado", "tired", "bags"], skins: [{ native: "🫩" }] },
      // Unicode 15.1 fallbacks (also missing in older datasets)
      { id: "phoenix", name: "Phoenix", keywords: ["fenix", "phoenix", "bird"], skins: [{ native: "🐦‍🔥" }] },
      { id: "lime", name: "Lime", keywords: ["lima", "lime", "fruit"], skins: [{ native: "🍋‍🟩" }] },
    ],
  },
];