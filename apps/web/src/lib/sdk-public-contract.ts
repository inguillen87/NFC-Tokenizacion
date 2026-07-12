export const NEXID_SDK_API_BASE = "https://api.nexid.lat";
export const NEXID_SDK_VERIFY_ROUTE = "/api/v1/sdk/verify";
export const NEXID_SDK_VERIFY_URL = `${NEXID_SDK_API_BASE}${NEXID_SDK_VERIFY_ROUTE}`;

export const NEXID_SDK_VERIFY_REQUIRED_FIELDS = ["bid", "picc_data", "enc", "cmac"] as const;
export const NEXID_SDK_VERIFY_OPTIONAL_FIELDS = ["gps", "deviceMeta"] as const;
