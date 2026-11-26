import type { BundledOrLocalWorkEntry, LiteratureWork } from '../types/work';

const bundledWorkModules = import.meta.glob<{ default: LiteratureWork }>('./works/*.json', {
  eager: true,
});

export const bundledWorks: LiteratureWork[] = Object.entries(bundledWorkModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => (mod.default ? mod.default : (mod as unknown as LiteratureWork)));

export const bundledWorkEntries: BundledOrLocalWorkEntry[] = bundledWorks.map((work) => ({
  work,
  origin: 'bundled',
}));

export function getBundledWorkById(workId: string): LiteratureWork | undefined {
  return bundledWorks.find((w) => w.metadata.id === workId);
}
