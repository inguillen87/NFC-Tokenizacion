import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [page, home, experience, copy, css, helpbot] = await Promise.all([
  read("../src/app/page.tsx"),
  read("../src/components/marketing-v4/nexid-home-v4.tsx"),
  read("../src/components/marketing-v4/nexid-home-experience.tsx"),
  read("../src/components/marketing-v4/home-copy.ts"),
  read("../src/components/marketing-v4/nexid-home-v4.module.css"),
  read("../src/components/contextual-helpbot.tsx"),
]);

test("home v4 is a server-first four-scene composition with one focused experience island", () => {
  assert.match(page, /<NexidHomeV4/);
  assert.match(page, /<Suspense fallback=\{null\}>[\s\S]*<CommercialContactModal initialLocale=\{locale\}/);
  assert.doesNotMatch(page, /"use client"|HeroSection|HeroScene|BrandSynergySimulator|SalesChatWidget|DemoRequestSection|PwaInstallPrompt/);

  assert.match(home, /data-nexid-home="v4"/);
  assert.equal((home.match(/<section\b/g) ?? []).length + (experience.match(/<section\b/g) ?? []).length, 4);
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((home.match(/<main\b/g) ?? []).length, 1);
  assert.match(experience, /id="how-it-works"/);
  assert.match(experience, /id="solutions"/);
  assert.match(home, /id="evidence"/);

  const flow = home.indexOf("<NexidProcessExperience");
  const roles = home.indexOf("<NexidRoleExperience");
  const evidence = home.indexOf('id="evidence"');
  assert.ok(flow > -1 && flow < roles && roles < evidence);
  assert.doesNotMatch(`${home}\n${experience}\n${copy}`, /NexidIndustryShowcase|HomeCaseStudyCopy|\bcaseStudy\b|id="product"|NexidMotionStory|id="visual-story"/);
});

test("home v4 keeps imagery in the light multivertical hero without repeating it downstream", () => {
  assert.match(home, /import Image from "next\/image"/);
  assert.equal((home.match(/<Image\b/g) ?? []).length, 1);
  assert.match(home, /src="\/nexid-lockup-horizontal\.svg"/);
  assert.match(experience, /import \{ AnimatePresence, motion, useReducedMotion \} from "framer-motion"/);
  assert.match(experience, /priority=\{activeIndex === 0\}/);
  assert.match(experience, /loading=\{activeIndex === 0 \? "eager" : "lazy"\}/);
  assert.match(experience, /sizes="\(max-width: 900px\) 100vw, 56vw"/);
  assert.match(home, /copy\.hero\.primary/);
  assert.match(home, /copy\.hero\.secondary/);
  assert.match(home, /href="#evidence"/);
  assert.match(home, /<NexidHeroExperience/);
  assert.match(copy, /agro-enterprise\.webp/);
  assert.match(copy, /pharma-enterprise\.webp/);
  assert.match(copy, /winery-enterprise\.webp/);
  assert.match(copy, /fashion-enterprise\.webp/);
  assert.match(experience, /agro: "seeds"/);
  assert.match(experience, /pharma: "pharma"/);
  assert.match(experience, /wine: "wine"/);
  assert.match(experience, /premium: "sneaker"/);
  assert.match(experience, /href=\{`\/demo-lab\?vertical=\$\{DEMO_VERTICAL_BY_SECTOR\[activeSector\.id\]\}`\}/);
  assert.equal((experience.match(/<Image\b/g) ?? []).length, 1);
  assert.doesNotMatch(experience, /sectors\.slice|sectors\[3\]|type IndustryShowcaseProps|industryPassport|industryStage/);
  assert.doesNotMatch(home, /<NexidProcessExperience[\s\S]{0,240}?sectors=\{/);
  assert.doesNotMatch(home, /wine-secure|Gran Reserva|Malbec/i);
  assert.doesNotMatch(`${home}\n${experience}`, /<video|autoPlay|react-globe|three|BrandSynergy|SalesChat|landing-mobile-action-dock/);
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.match(experience, /className=\{styles\.resultCard\}[\s\S]{0,260}?x: narrowViewport \? 28 : 72/);
  assert.match(css, /\.resultCard\s*\{[\s\S]{0,420}?22\.5rem[\s\S]{0,420}?rgb\(4 20 14 \/ 42%\)/);
  assert.match(css, /\.resultCard dl,[\s\S]{0,100}?\.resultCard small \{ display: none; \}/);
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("home v4 gives process, workspaces and evidence distinct visual grammars", () => {
  assert.match(experience, /className=\{styles\.processScene\}/);
  assert.match(experience, /className=\{styles\.identityObject\}/);
  assert.match(experience, /className=\{styles\.verificationCore\}/);
  assert.match(experience, /className=\{styles\.actionSurface\}/);
  assert.match(experience, /className=\{styles\.roleWorkspace\}/);
  assert.match(home, /className=\{styles\.evidenceLedger\}/);
  assert.equal((experience.match(/export function Nexid(?:Hero|Process|Role)Experience/g) ?? []).length, 3);
  assert.doesNotMatch(experience, /mode="wait"/);
});

test("home v4 motion stays controllable, quiet and resource-aware", () => {
  assert.match(experience, /HERO_ROTATION_MS = 5_800/);
  assert.match(experience, /PROCESS_STEP_MS = 1_650/);
  assert.match(experience, /IntersectionObserver/);
  assert.match(experience, /document\.visibilityState === "visible"/);
  assert.match(experience, /aria-live="off"/);
  assert.match(experience, /aria-pressed=\{manualPaused\}/);
  assert.match(experience, /setManualPaused\(true\)/);
  assert.match(experience, /!hasPlayed/);
  assert.match(experience, /setHasPlayed\(true\)/);
  assert.match(experience, /!inViewport/);
  assert.match(experience, /window\.clearInterval/);
  assert.match(experience, /window\.clearTimeout/);
  assert.match(experience, /useReducedMotion\(\)/);
  assert.match(experience, /controls\.pause/);
  assert.match(experience, /controls\.replay/);
});

test("home v4 removes competing assistants but preserves a working sales handoff", () => {
  assert.match(home, /contact=sales&intent=company_rollout#contact-modal/);
  assert.match(helpbot, /pathname === "\/"/);
  assert.match(helpbot, /return null/);
  assert.doesNotMatch(home, /SalesChatWidget|DemoRequestSection|HelpBot/);
});
