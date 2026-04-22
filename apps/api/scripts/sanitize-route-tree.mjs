import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');

const deprecatedRewardsRedemptionPath = path.join(
  apiRoot,
  'src',
  'app',
  'consumer',
  'rewards',
  '[redemptionId]',
);

if (existsSync(deprecatedRewardsRedemptionPath)) {
  rmSync(deprecatedRewardsRedemptionPath, { recursive: true, force: true });
  console.warn(
    `[sanitize-route-tree] Removed deprecated dynamic route folder: ${path.relative(apiRoot, deprecatedRewardsRedemptionPath)}`,
  );
} else {
  console.log('[sanitize-route-tree] No deprecated reward/redemption route conflicts found.');
}
