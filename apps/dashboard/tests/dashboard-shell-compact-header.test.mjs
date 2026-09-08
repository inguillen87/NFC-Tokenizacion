import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";

const shell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/components/dashboard-shell-header.module.css", import.meta.url), "utf8");
const css = postcss.parse(styles);
const headerStart = shell.indexOf('<header data-testid="dashboard-compact-header"');
const headerEnd = shell.indexOf("</header>", headerStart);
const header = shell.slice(headerStart, headerEnd);

test("closed mobile navigation is removed from keyboard focus without hiding desktop navigation", () => {
  assert.match(shell, /isMobileSidebarOpen \? "visible translate-x-0" : "invisible -translate-x-full lg:visible lg:translate-x-0"/);
});

function baseRule(selector) {
  const rules = css.nodes.filter((node) => node.type === "rule" && node.selectors.includes(selector));
  assert.equal(rules.length, 1, `Expected one base rule for ${selector}`);
  return rules[0];
}

function declaration(rule, property) {
  return rule.nodes.find((node) => node.type === "decl" && node.prop === property);
}

function property(rule, name) {
  return declaration(rule, name)?.value;
}

test("compact header gives identity and controls two mobile rows with no clipped action group", () => {
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  assert.match(header, /className=\{headerStyles\.identity\}/);
  assert.match(header, /className=\{headerStyles\.controls\}/);
  assert.equal(property(baseRule(".layout"), "grid-template-columns"), "minmax(0, 1fr)");
  assert.equal(property(baseRule(".controls"), "flex-wrap"), "nowrap");
  for (const selector of [".header", ".layout", ".identity", ".controls"]) {
    const rule = baseRule(selector);
    for (const name of ["overflow", "overflow-x", "overflow-y"]) {
      assert.ok(!/hidden|clip/.test(property(rule, name) || ""), `${selector} must not clip controls or their focus rings`);
    }
  }
});

test("desktop header responds to its available width after the sidebar", () => {
  assert.equal(property(baseRule(".header"), "container-type"), "inline-size");
  const desktopLayouts = [];
  css.walkAtRules("container", (container) => {
    container.walkRules(".layout", (rule) => desktopLayouts.push(rule));
  });
  assert.ok(desktopLayouts.some((rule) => property(rule, "grid-template-columns") === "minmax(0, 1fr) auto"));
  assert.equal(property(baseRule(".identity"), "min-width"), "0");
  assert.equal(property(baseRule(".heading"), "min-width"), "0");
});

test("compact controls retain touch targets and account sizing overrides legacy mobile minima", () => {
  for (const selector of [
    ".header .controls :global(.locale-switcher)",
    ".header .controls :global(.theme-toggle)",
    ".header .controls :global(.admin-notification-bell)",
  ]) {
    const minHeight = property(baseRule(selector), "min-height");
    assert.ok(minHeight?.endsWith("rem") && Number.parseFloat(minHeight) >= 2.75, `${selector} needs a 44px target at the default font size`);
  }
  const trigger = baseRule('.header .controls :global(.dashboard-shell-account-menu) :global([data-testid="tenant-account-menu-trigger"])');
  for (const [name, value] of [["min-width", "0"], ["width", "100%"], ["max-width", "100%"]]) {
    assert.equal(property(trigger, name), value);
    assert.equal(declaration(trigger, name)?.important, true, `${name} must override globals.css mobile sizing`);
  }
});

test("condensed heading keeps context descriptions and existing controls connected", () => {
  const description = header.match(/<h1\b[^>]*aria-describedby="([^"]+)"/)?.[1];
  assert.ok(description, "The title must describe the context removed from the visible mobile layout");
  for (const id of ["dashboard-header-context", "dashboard-header-audience", "dashboard-header-data-status"]) {
    assert.ok(description.split(/\s+/).includes(id));
    assert.equal((header.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  }
  for (const selector of [".context", ".secondaryContext"]) {
    assert.notEqual(property(baseRule(selector), "display"), "none");
    assert.notEqual(property(baseRule(selector), "visibility"), "hidden");
  }
  assert.match(header, /aria-expanded=\{isMobileSidebarOpen\}/);
  assert.match(header, /aria-controls="dashboard-primary-navigation"/);
  assert.match(shell, /<aside\b[^>]*id="dashboard-primary-navigation"/);
  assert.match(header, /canOpenDestination\("leadsTickets"\) \? \(\s*<AdminNotificationBell canReadSensitiveEvents=\{canReadSensitiveEvents\}/);
  assert.match(header, /<LocaleSwitcher value=\{locale\} options=\{\[\.\.\.locales\]\}/);
  assert.match(header, /<SharedThemeToggle locale=\{locale\}/);
  assert.match(header, /<TenantAccountMenu[\s\S]*permissions=\{currentPermissions\}[\s\S]*deniedPermissions=\{currentDeniedPermissions\}/);
});

test("header restores visible keyboard focus for the locale select", () => {
  const focusRules = [];
  css.walkRules((rule) => {
    if (rule.selector.includes(":focus-visible") && /select|locale-switcher/.test(rule.selector)) focusRules.push(rule);
  });
  assert.ok(focusRules.some((rule) => {
    const outline = property(rule, "outline");
    const shadow = property(rule, "box-shadow");
    return (outline && !/^(?:none|0)(?:\s|$)/.test(outline)) || (shadow && shadow !== "none");
  }), "The shared locale selector removes its default outline; the compact header must restore visible focus");
});

test("sandbox explanation remains visible outside the compact sticky header", () => {
  assert.doesNotMatch(header, /canShowSandboxTools|Sandbox tools enabled/);
  const sandboxStart = shell.indexOf("{canShowSandboxTools ? (", headerEnd);
  const demoWarningStart = shell.indexOf('data-testid="dashboard-demo-session-warning"', headerEnd);
  assert.ok(sandboxStart > headerEnd && sandboxStart < demoWarningStart);
  assert.match(shell.slice(sandboxStart, demoWarningStart), /Sandbox tools enabled/);
});
