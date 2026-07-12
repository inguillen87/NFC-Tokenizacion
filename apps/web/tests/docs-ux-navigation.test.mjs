import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readDocsConsole = () =>
  readFile(new URL("../src/app/docs/docs-integration-console.tsx", import.meta.url), "utf8");
const readDocsPage = () => readFile(new URL("../src/app/docs/page.tsx", import.meta.url), "utf8");

test("docs use one complete section model for sticky desktop and mobile navigation", async () => {
  const [consoleComponent, page] = await Promise.all([readDocsConsole(), readDocsPage()]);

  assert.equal((consoleComponent.match(/export const docsSectionItems/g) ?? []).length, 1);
  assert.match(consoleComponent, /id: "strategy"/);
  assert.doesNotMatch(consoleComponent, /const navItems/);
  assert.match(consoleComponent, /docsSectionItems\.map\(\(item\) =>/);
  assert.match(consoleComponent, /className="sticky top-16[^\"]*lg:hidden"/);
  assert.match(consoleComponent, /<select[\s\S]*value=\{activeItem\.id\}[\s\S]*onChange=\{onMobileSectionChange\}/);
  assert.match(consoleComponent, /<aside className="sticky top-20 hidden[^\"]*lg:block">/);
  assert.match(consoleComponent, /aria-current=\{isActive \? "location" : undefined\}/);

  const layoutStart = page.indexOf('className="grid min-w-0 items-start gap-4 lg:grid-cols');
  const navIndex = page.indexOf("<DocsSectionNavigation", layoutStart);
  const contentIndex = page.indexOf('className="min-w-0 space-y-8"', navIndex);
  const consoleIndex = page.indexOf("<DocsIntegrationConsole", contentIndex);
  const strategyIndex = page.indexOf('id="strategy"', consoleIndex);
  const actionsIndex = page.indexOf('id="actions"', strategyIndex);

  assert.ok(layoutStart > -1, "expected the full docs grid");
  assert.ok(navIndex > layoutStart, "expected section navigation inside the full docs grid");
  assert.ok(contentIndex > navIndex, "expected docs content alongside the navigation");
  assert.ok(consoleIndex > contentIndex, "expected integration console in the docs content column");
  assert.ok(strategyIndex > consoleIndex, "expected strategy after the console in the same content column");
  assert.ok(actionsIndex > strategyIndex, "expected actions at the end of the same content column");
});

test("docs snippet tabs implement keyboard and WAI-ARIA semantics", async () => {
  const consoleComponent = await readDocsConsole();

  assert.match(consoleComponent, /role="tablist"/);
  assert.match(consoleComponent, /role="tab"/);
  assert.match(consoleComponent, /aria-selected=\{activeSnippet === id\}/);
  assert.match(consoleComponent, /aria-controls="docs-code-panel"/);
  assert.match(consoleComponent, /tabIndex=\{activeSnippet === id \? 0 : -1\}/);
  assert.match(consoleComponent, /role="tabpanel"/);
  assert.match(consoleComponent, /aria-labelledby=\{`docs-code-tab-\$\{activeSnippet\}`\}/);
  assert.match(consoleComponent, /event\.key === "ArrowRight"/);
  assert.match(consoleComponent, /event\.key === "ArrowLeft"/);
  assert.match(consoleComponent, /event\.key === "Home"/);
  assert.match(consoleComponent, /event\.key === "End"/);
  assert.match(consoleComponent, /tabRefs\.current\[nextSnippet\]\?\.focus\(\)/);
});

test("docs copy feedback distinguishes success and failure without changing snippets", async () => {
  const consoleComponent = await readDocsConsole();

  assert.match(consoleComponent, /if \(!navigator\.clipboard\?\.writeText\) throw new Error/);
  assert.match(consoleComponent, /setCopyStatus\(\{ kind: "success", snippet: activeSnippet \}\)/);
  assert.match(consoleComponent, /catch \{[\s\S]*setCopyStatus\(\{ kind: "error", snippet: activeSnippet \}\)/);
  assert.match(consoleComponent, /copyFailed: "No se pudo copiar"/);
  assert.match(consoleComponent, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(consoleComponent, /const snippets: Record<SnippetId, string>/);
  assert.match(consoleComponent, /curl:[\s\S]*node:[\s\S]*python:/);
  assert.match(consoleComponent, /\{highlightedLine\(line, activeSnippet\)\}/);
});
