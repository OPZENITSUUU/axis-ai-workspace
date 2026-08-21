export const editorialTokens = {
  parchment: "#e5e4e0",
  ink: "#1d1d1d",
  paper: "#ffffff",
  ash: "#bfbebe",
  stone: "#cdcdc9",
  iridescentSphere: "#facb00",
  captionSize: 11,
  bodySmallSize: 15,
  bodySize: 18,
  spacingElement: 19,
  spacingCard: 30,
  radiusInteractive: 10,
} as const;

export const axisMobileTheme = {
  canvas: "#060914",
  panel: "#111a2a",
  text: "#f5f7fb",
  muted: "#9ba7b7",
  accent: "#85dfb9",
  accentInk: "#06261c",
  outline: "rgba(183, 213, 245, 0.18)",
  editorialAccent: editorialTokens.iridescentSphere,
} as const;
