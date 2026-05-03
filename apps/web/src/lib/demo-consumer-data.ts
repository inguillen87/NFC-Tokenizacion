export const DEMO_CONSUMER_EMAIL = "demo.consumer@nexid.local";
export const DEMO_CONSUMER_CODE = "000000";
export const DEMO_CONSUMER_COOKIE = "nexid_consumer_demo=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200";

export function hasDemoConsumerCookie(cookie: string) {
  return /(?:^|;\s*)nexid_consumer_demo=1(?:;|$)/.test(cookie || "");
}

export function demoConsumerCookieEnabled() {
  const flag = String(process.env.NEXT_PUBLIC_DEMO_CONSUMER_ENABLED || process.env.DEMO_CONSUMER_ENABLED || "false").toLowerCase();
  return !["0", "false", "off", "no"].includes(flag);
}

export function demoConsumerPayload(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/consumer/session") return { ok: true, authenticated: true, demo: true };
  if (normalized === "/consumer/me") {
    return {
      ok: true,
      consumer: {
        email: DEMO_CONSUMER_EMAIL,
        display_name: "Demo Consumer",
        passport_status: "active",
        preferred_locale: "es-AR",
      },
      stats: { products: 3, taps: 7, memberships: 2, unread: 0, rewards: 420 },
    };
  }
  if (normalized === "/consumer/products") {
    return {
      ok: true,
      items: [
        { product_name: "Gran Reserva Malbec", tenant_slug: "demobodega", ownership_status: "claimed", ownership_record_status: "claimed" },
        { product_name: "Pulsera VIP", tenant_slug: "demoeventos", ownership_status: "claimed", ownership_record_status: "claimed" },
        { product_name: "Serum premium", tenant_slug: "democosmetica", ownership_status: "viewed", ownership_record_status: "viewed" },
      ],
    };
  }
  if (normalized === "/consumer/taps") {
    return {
      ok: true,
      items: [
        { verdict: "VALID", tenant_slug: "demobodega", city: "Zurich", country: "CH", created_at: new Date(0).toISOString() },
        { verdict: "VALID", tenant_slug: "demobodega", city: "Mendoza", country: "AR", created_at: new Date(1).toISOString() },
        { verdict: "VALID", tenant_slug: "demoeventos", city: "Buenos Aires", country: "AR", created_at: new Date(2).toISOString() },
      ],
    };
  }
  if (normalized === "/consumer/brands") {
    return {
      ok: true,
      items: [
        { slug: "demobodega", name: "Demo Bodega", status: "active" },
        { slug: "demoeventos", name: "Demo Eventos", status: "active" },
      ],
    };
  }
  if (normalized === "/consumer/wallet") {
    return { ok: true, balance_points: 420, memberships: 2, saved_products: 3, trust_score: 92 };
  }
  return null;
}

export function demoMarketplacePayload(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/marketplace/products" || normalized.startsWith("/marketplace/products?")) {
    return {
      ok: true,
      demo: true,
      items: [
        {
          id: "demo-wine-001",
          title: "Gran Reserva Malbec - club release",
          brand_name: "Demo Bodega",
          brand: "Demo Bodega",
          points_price: 320,
          cash_price: 0,
          stock_status: "available",
          request_to_buy_enabled: true,
          age_gate_required: true,
        },
        {
          id: "demo-vip-002",
          title: "Upgrade VIP wristband",
          brand_name: "Demo Eventos",
          brand: "Demo Eventos",
          points_price: 180,
          cash_price: 25,
          stock_status: "available",
          request_to_buy_enabled: true,
          age_gate_required: false,
        },
        {
          id: "demo-cos-003",
          title: "Premium serum sample drop",
          brand_name: "Demo Cosmetica",
          brand: "Demo Cosmetica",
          points_price: 90,
          cash_price: 0,
          stock_status: "available",
          request_to_buy_enabled: true,
          age_gate_required: false,
        },
      ],
    };
  }
  if (/^\/marketplace\/products\/[^/]+\/request-to-buy$/.test(normalized)) {
    return {
      ok: true,
      demo: true,
      checkout: "request_only",
      orderRequest: {
        id: `demo-order-${Date.now()}`,
        status: "new",
        created_at: new Date().toISOString(),
      },
    };
  }
  return null;
}
