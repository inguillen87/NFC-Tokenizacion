import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  isSecurePostTapActionAllowed,
  resolveCommercialTapFreshness,
  resolvePostTapQuickActionAvailability,
} = await import("../src/app/sun/post-tap-policy.ts");

test("one blocked commercial action never invalidates an otherwise fresh authentic tap", () => {
  assert.equal(resolveCommercialTapFreshness({
    isTechnicallyAuthentic: true,
    isFreshHandoff: false,
    isSnapshotView: false,
  }), true);
  assert.equal(resolveCommercialTapFreshness({
    isTechnicallyAuthentic: true,
    isFreshHandoff: true,
    isSnapshotView: true,
  }), false);
  assert.equal(resolveCommercialTapFreshness({
    isTechnicallyAuthentic: false,
    isFreshHandoff: true,
    isSnapshotView: false,
  }), false);

  const blockedOnly = { allowedActions: [], blockedActions: ["tokenization"] };
  assert.equal(isSecurePostTapActionAllowed("claimOwnership", blockedOnly.allowedActions, blockedOnly.blockedActions), true);
  assert.equal(isSecurePostTapActionAllowed("registerWarranty", blockedOnly.allowedActions, blockedOnly.blockedActions), true);
  assert.equal(isSecurePostTapActionAllowed("provenance", blockedOnly.allowedActions, blockedOnly.blockedActions), true);
  assert.equal(isSecurePostTapActionAllowed("tokenization", blockedOnly.allowedActions, blockedOnly.blockedActions), false);
  assert.equal(isSecurePostTapActionAllowed("report", blockedOnly.allowedActions, blockedOnly.blockedActions), true);
});

test("quick post-tap CTAs independently honor allow and block policy", () => {
  const available = resolvePostTapQuickActionAvailability({
    allowedActions: ["claim", "provenance", "rewards"],
    blockedActions: ["warranty", "tokenization", "marketplace"],
  });

  assert.deepEqual(available, {
    primary: true,
    warranty: false,
    trace: true,
    certificate: true,
    rewards: true,
    marketplace: false,
    wallet: true,
  });

  const provenanceOnly = resolvePostTapQuickActionAvailability({
    allowedActions: ["provenance"],
    blockedActions: ["claim", "warranty", "rewards", "tokenization"],
  });
  assert.deepEqual(provenanceOnly, {
    primary: false,
    warranty: false,
    trace: true,
    certificate: true,
    rewards: false,
    marketplace: true,
    wallet: false,
  });
});

test("post-tap journey adapts the next action without implying ownership from a tap", async () => {
  const component = await readFile(new URL("../src/app/sun/post-tap-next-step.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");

  assert.match(component, /type JourneyKind = "wine" \| "seeds" \| "chemicals" \| "logistics" \| "pharma" \| "consumer"/);
  assert.ok(component.indexOf("if (/agroqu") < component.indexOf("if (/seed"), "chemicals must be classified before generic agro or seed copy");
  assert.ok(component.indexOf("if (/logistic") < component.indexOf("if (/wine"), "operational carriers must not inherit consumer wine actions");
  assert.match(component, /el tap por s[ií] solo no transfiere custodia ni propiedad/i);
  assert.match(component, /Ninguna ocurre s[oó]lo por acercar el tel[eé]fono/i);
  assert.match(component, /resolvePostTapQuickActionAvailability\(\{ allowedActions, blockedActions \}\)/);
  assert.match(component, /const supportsRewards = \(journeyKind === "wine" \|\| journeyKind === "consumer"\) && available\.rewards/);
  assert.match(component, /const supportsWallet = \(journeyKind === "wine" \|\| journeyKind === "consumer"\)/);
  assert.match(component, /available\.primary \? \(/);
  assert.match(component, /href: "#warranty-action"/);
  assert.match(component, /available\.marketplace \? \[/);
  assert.match(component, /Wallet o NFT s[oó]lo si la pol[ií]tica y la compra quedan validadas/i);
  assert.match(component, /href=\{primaryActionHref\}/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-current="step"/);

  assert.match(page, /import \{ PostTapNextStep \} from "\.\/post-tap-next-step"/);
  assert.match(page, /<PostTapNextStep[\s\S]*vertical=\{`\$\{verticalLabel\}[\s\S]*isFreshTap=\{isFreshCommercialTap\}/);
  assert.match(page, /allowedActions=\{allowedActions\}[\s\S]*blockedActions=\{blockedActions\}/);
  assert.match(page, /primaryActionHref=\{bid && \(uid \|\| eventId\) \? "#protected-actions" : registerHref\}/);
  assert.match(page, /id="protected-actions"/);
  assert.match(page, /id="fresh-tap-required"/);
  assert.doesNotMatch(page, /isCommercialBlocked/);
  assert.doesNotMatch(page, /Registrar Propiedad \/ Garant[ií]a/);

  const actions = await readFile(new URL("../src/app/sun/cta-actions.tsx", import.meta.url), "utf8");
  assert.match(actions, /const ownerClaimState = !canStartClaim/);
  assert.match(actions, /<strong className="text-xs text-white">\{ownerClaimState\}<\/strong>/);
  assert.doesNotMatch(actions, /ownerClaimScore|canStartClaim && isAuthenticated \? 92/);
  assert.match(actions, /id=\{key === "registerWarranty" \? "warranty-action" : undefined\}/);
});

test("real taps never fabricate sensor history, tasting awards or chain-of-custody evidence", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const hasReportedSensorEvidence = Boolean\(/);
  assert.match(page, /const sensorEvidenceKind = String\(result\.iot\?\.sensorEvidenceKind \|\| "none"\)/);
  assert.match(page, /sensorEvidenceKind === "reported"/);
  assert.match(page, /const usesDemoSensorEvidence = isDemoPreview && !hasReportedSensorEvidence/);
  assert.match(page, /usesDemoSensorEvidence \? "15\.2°C" : "N\/A"/);
  assert.match(page, /Sin telemetr[ií]a IoT asociada a este lote/i);
  assert.match(page, /no inferimos temperatura, humedad ni golpes sin evidencia/i);
  assert.match(page, /Esta tarjeta muestra una muestra puntual/i);
  assert.match(page, /Datos simulados del Demo Lab/);
  assert.match(page, /no son certificaciones reales/i);
  assert.doesNotMatch(page, /James Suckling|Decanter Awards|ESTABLE \(/);
  assert.doesNotMatch(page, /id="sensorGrad"|Historial de Temperatura/);
  assert.match(page, /const isWineProduct = \[result\.product\?\.vertical, result\.tenant\?\.vertical, productDisplayName\]/);
});

test("QR engagement is wine-only, policy-aware and never confirms local rewards or failed opt-ins", async () => {
  const page = await readFile(new URL("../src/app/sun/page.tsx", import.meta.url), "utf8");
  const engagement = await readFile(new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url), "utf8");

  assert.match(page, /!isQrScan && trustSignals\.antiReplay === false/);
  assert.match(page, /\(!isTechnicallyAuthentic && !isQrScan\)/);
  assert.match(page, /const showEngagementSuite = engagementBaseEligible && isWineProduct/);
  assert.match(page, /<QREngagementSuite[\s\S]*allowedActions=\{allowedActions\}[\s\S]*blockedActions=\{blockedActions\}/);
  assert.match(page, /postTapQuickActions\.marketplace \? \(/);
  assert.match(page, /routes=\{isDemoPreview \? opsMapRoutes : \[\]\}/);
  assert.match(page, /mode=\{isDemoPreview \? "demo" : "global"\}/);
  assert.match(page, /initialView=\{!isDemoPreview && canShowSunIntensity \? "intensity" : "events"\}/);
  assert.match(page, /allowViewToggle=\{!isDemoPreview && canShowSunIntensity\}/);
  assert.match(page, /ninguna l[ií]nea implica un recorrido f[ií]sico/);
  assert.match(page, /no reconstruye transporte, custodia ni movimiento del producto/);

  assert.match(engagement, /const canUseRewards = isPostTapPolicyActionAllowed\("rewards", allowedActions, blockedActions\)/);
  assert.match(engagement, /pointsAwarded: 0/);
  assert.match(engagement, /isLocal: true/);
  assert.match(engagement, /Resultado educativo local: no se otorgaron puntos ni premios/);
  assert.match(engagement, /if \(!response\.ok \|\| result\?\.ok !== true\)/);
  assert.match(engagement, /if \(saved\) setFeedbackSubmitted\(true\)/);
  assert.match(engagement, /if \(saved\) setOptInSubmitted\(true\)/);
  assert.match(engagement, /Este formulario no promete premios/);
  assert.doesNotMatch(engagement, /monthly_winery_box|qr_raffle|Ya estás participando/);
});
