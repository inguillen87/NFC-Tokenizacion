import fs from 'node:fs';
import path from 'node:path';

export type DemoPackMeta = {
  key: string;
  manifestPath: string;
  seedPath: string;
  icType: string;
  batchId: string;
};

function parseManifest(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split('\n');
  if (lines.length < 2) return { icType: 'UNKNOWN', batchId: 'DEMO-2026-02' };
  const headers = lines[0].split(',').map((h) => h.trim());
  const first = lines[1].split(',').map((v) => v.trim());
  const row = Object.fromEntries(headers.map((h, i) => [h, first[i] || '']));
  return { icType: String(row.ic_type || 'UNKNOWN'), batchId: String(row.batch_id || 'DEMO-2026-02') };
}

export function listDemoPacks(): DemoPackMeta[] {
  const demoDir = path.resolve(process.cwd(), 'prisma', 'demo');
  if (!fs.existsSync(demoDir)) return [];
  const dirs = fs.readdirSync(demoDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  return dirs
    .map((dir) => {
      const manifestPath = path.join(demoDir, dir.name, 'manifest.csv');
      const seedPath = path.join(demoDir, dir.name, 'seed.json');
      if (!fs.existsSync(manifestPath) || !fs.existsSync(seedPath)) return null;
      const { icType, batchId } = parseManifest(manifestPath);
      return { key: dir.name, manifestPath, seedPath, icType, batchId } as DemoPackMeta;
    })
    .filter((x): x is DemoPackMeta => Boolean(x))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function getDemoPack(pack: string): DemoPackMeta | null {
  const found = listDemoPacks().find((p) => p.key === pack);
  return found || null;
}
