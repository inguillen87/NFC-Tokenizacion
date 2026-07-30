export const NEXID_SDK_API_BASE = "https://api.nexid.lat";
export const NEXID_SDK_VERIFY_ROUTE = "/api/v1/sdk/verify";
export const NEXID_SDK_VERIFY_URL = `${NEXID_SDK_API_BASE}${NEXID_SDK_VERIFY_ROUTE}`;
export const NEXID_SDK_EPCIS_CAPTURE_ROUTE = "/api/v1/sdk/epcis/capture";
export const NEXID_SDK_EPCIS_EVENTS_ROUTE = "/api/v1/sdk/epcis/events";
export const NEXID_SDK_EPCIS_EXPORT_ROUTE = "/api/v1/sdk/epcis/export";
export const NEXID_SDK_EPCIS_CAPTURE_URL = `${NEXID_SDK_API_BASE}${NEXID_SDK_EPCIS_CAPTURE_ROUTE}`;
export const NEXID_SDK_OPENAPI_URL = `${NEXID_SDK_API_BASE}/openapi/nexid-sdk-v1.json`;
export const NEXID_SDK_ASYNCAPI_URL = `${NEXID_SDK_API_BASE}/asyncapi/nexid-webhooks-v1.json`;

export const NEXID_SDK_VERIFY_REQUIRED_FIELDS = ["bid", "picc_data", "enc", "cmac"] as const;
export const NEXID_SDK_VERIFY_OPTIONAL_FIELDS = ["gps", "deviceMeta"] as const;
