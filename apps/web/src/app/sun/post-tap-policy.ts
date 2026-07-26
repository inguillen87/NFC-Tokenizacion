export type PostTapPolicyAction =
  | "claim"
  | "save"
  | "join"
  | "warranty"
  | "rewards"
  | "tokenization"
  | "provenance"
  | "marketplace";

export type SecurePostTapActionKey =
  | "claimOwnership"
  | "registerWarranty"
  | "provenance"
  | "tokenization"
  | "report";

export type PostTapQuickActionAvailability = {
  primary: boolean;
  warranty: boolean;
  trace: boolean;
  certificate: boolean;
  rewards: boolean;
  marketplace: boolean;
  wallet: boolean;
};

const SECURE_ACTION_POLICY: Partial<Record<SecurePostTapActionKey, PostTapPolicyAction>> = {
  claimOwnership: "claim",
  registerWarranty: "warranty",
  provenance: "provenance",
  tokenization: "tokenization",
};

function normalizeActions(actions: readonly string[]) {
  return new Set(actions.map((action) => String(action).trim().toLowerCase()).filter(Boolean));
}

export function isPostTapPolicyActionAllowed(
  action: PostTapPolicyAction,
  allowedActions: readonly string[] = [],
  blockedActions: readonly string[] = [],
) {
  const allowed = normalizeActions(allowedActions);
  const blocked = normalizeActions(blockedActions);

  if (blocked.has(action)) return false;
  // Some older contracts only return explicit denials. Treat that shape as a
  // deny-list so one blocked capability cannot disable every unrelated CTA.
  return allowed.size === 0 || allowed.has(action);
}

export function isAnyPostTapPolicyActionAllowed(
  actions: readonly PostTapPolicyAction[],
  allowedActions: readonly string[] = [],
  blockedActions: readonly string[] = [],
) {
  return actions.some((action) => isPostTapPolicyActionAllowed(action, allowedActions, blockedActions));
}

export function isSecurePostTapActionAllowed(
  actionKey: SecurePostTapActionKey,
  allowedActions: readonly string[] = [],
  blockedActions: readonly string[] = [],
) {
  if (actionKey === "report") return true;
  const policyAction = SECURE_ACTION_POLICY[actionKey];
  return policyAction
    ? isPostTapPolicyActionAllowed(policyAction, allowedActions, blockedActions)
    : true;
}

export function resolvePostTapQuickActionAvailability({
  allowedActions = [],
  blockedActions = [],
}: {
  allowedActions?: readonly string[];
  blockedActions?: readonly string[];
}): PostTapQuickActionAvailability {
  const primary = isPostTapPolicyActionAllowed("claim", allowedActions, blockedActions);
  const warranty = isPostTapPolicyActionAllowed("warranty", allowedActions, blockedActions);
  const provenance = isPostTapPolicyActionAllowed("provenance", allowedActions, blockedActions);

  return {
    primary,
    warranty,
    trace: provenance,
    certificate: provenance,
    rewards: isPostTapPolicyActionAllowed("rewards", allowedActions, blockedActions),
    // Marketplace browsing is not part of the canonical SUN mutation matrix.
    // Honor an explicit block without hiding a read-only catalog merely because
    // older allow-lists omit this optional capability.
    marketplace: !normalizeActions(blockedActions).has("marketplace"),
    wallet: isAnyPostTapPolicyActionAllowed(["claim", "tokenization"], allowedActions, blockedActions),
  };
}

export function resolveCommercialTapFreshness({
  isTechnicallyAuthentic,
  isFreshHandoff,
  isSnapshotView,
}: {
  isTechnicallyAuthentic: boolean;
  isFreshHandoff: boolean;
  isSnapshotView: boolean;
}) {
  if (isSnapshotView) return false;
  return isTechnicallyAuthentic && (isFreshHandoff || !isSnapshotView);
}
