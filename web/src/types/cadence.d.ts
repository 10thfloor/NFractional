declare module "@flow-hackathon/cadence" {
  export const files: Record<string, string>;
  export const list: string[];
  export function get(pathRel: string): string | null;
}
