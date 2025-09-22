// Known-brand NFT collection hints for detection and UX labeling (emulator-first)
export type BrandHint = {
  brand: "TopShot" | "Pinnacle" | "Unknown";
  publicPathCandidates: string[]; // identifiers (no /public prefix)
  storagePathCandidates: string[]; // identifiers (no /storage prefix)
  typeIdIncludes: string[]; // substrings to match against CollectionPublic typeId
  label: string;
};

export const KNOWN_BRANDS: BrandHint[] = [
  {
    brand: "TopShot",
    label: "NBA Top Shot",
    publicPathCandidates: [
      "MomentCollection",
      "TopShotCollection",
      "nbatopshot",
    ],
    storagePathCandidates: [
      "MomentCollection",
      "TopShotCollection",
      "nbatopshot",
    ],
    typeIdIncludes: ["TopShot", "Moment", "NBATopShot"],
  },
  {
    brand: "Pinnacle",
    label: "Disney Pinnacle",
    publicPathCandidates: ["PinnacleCollection", "DisneyPinnacle", "pinnacle"],
    storagePathCandidates: ["PinnacleCollection", "DisneyPinnacle", "pinnacle"],
    typeIdIncludes: ["Pinnacle", "DisneyPinnacle"],
  },
];

export function guessBrandByTypeId(typeId: string): BrandHint | null {
  const tid = (typeId || "").toLowerCase();
  for (const b of KNOWN_BRANDS) {
    if (b.typeIdIncludes.some((s) => tid.includes(s.toLowerCase()))) return b;
  }
  return null;
}
