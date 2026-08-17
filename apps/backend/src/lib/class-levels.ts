export const CLASS_LEVELS = ["Iniciante", "Intermediário", "Avançado"] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number];

export function classLevelRank(level: string): number {
  const index = CLASS_LEVELS.indexOf(level as ClassLevel);
  return index === -1 ? CLASS_LEVELS.length : index;
}
