export type DemoDataMeta = {
  demoMode: boolean;
  dataSource: "demo" | "production";
  demoSource: string;
};

function readHeader(headers: Headers, key: string) {
  return String(headers.get(key) || "").trim().toLowerCase();
}

export function readDemoDataMetaFromResponse(response: Response): DemoDataMeta {
  const mode = readHeader(response.headers, "x-nexid-data-mode");
  const demoSource = readHeader(response.headers, "x-nexid-demo-source");
  const demoMode = mode === "demo";
  return {
    demoMode,
    dataSource: demoMode ? "demo" : "production",
    demoSource: demoSource || (demoMode ? "fallback" : "production"),
  };
}

export function readDemoDataMetaFromPayload(payload: unknown): DemoDataMeta {
  const raw = (payload && typeof payload === "object") ? (payload as Record<string, unknown>) : {};
  const demoMode = raw.demoMode === true || String(raw.dataSource || "").toLowerCase() === "demo";
  return {
    demoMode,
    dataSource: demoMode ? "demo" : "production",
    demoSource: demoMode ? "fallback" : "production",
  };
}
