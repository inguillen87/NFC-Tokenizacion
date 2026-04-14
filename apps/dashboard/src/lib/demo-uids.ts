export const DEMO_SUPPLIER_BATCH_ID = "DEMO-2026-02";

// Source of truth: root demobodega_manifest.csv and apps/api/prisma/demo/demobodega_manifest.csv
export const DEMO_SUPPLIER_UIDS = [
  "04B7723410E2AD",
  "04B7723410E2AE",
  "04B7723410E2AF",
  "04B7723410E2B0",
  "04B7723410E2B1",
  "04B7723410E2B2",
  "04B7723410E2B3",
  "04B7723410E2B4",
  "04B7723410E2B5",
  "04B7723410E2B6",
] as const;

export const DEMO_SUPPLIER_UID_TEXT = ["uid_hex", ...DEMO_SUPPLIER_UIDS].join("\n");
