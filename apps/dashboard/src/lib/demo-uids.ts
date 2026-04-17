export const DEMO_SUPPLIER_BATCH_ID = "DEMO-2026-02";

// Source of truth: root demobodega_manifest.csv and apps/api/prisma/demo/demobodega_manifest.csv
export const DEMO_SUPPLIER_UIDS = [
  "0487856A0B1090",
  "048A876A0B1090",
  "0483846A0B1090",
  "047F846A0B1090",
  "047B846A0B1090",
  "0477846A0B1090",
  "0474856A0B1090",
  "0470856A0B1090",
  "0483826A0B1090",
  "0465846A0B1090",
] as const;

export const DEMO_SUPPLIER_UID_TEXT = ["uid_hex", ...DEMO_SUPPLIER_UIDS].join("\n");
