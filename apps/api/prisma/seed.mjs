import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureUser(email, fullName) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName },
    create: { email, fullName },
  });
}

async function ensureMembership(userId, tenantId, role) {
  return prisma.membership.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { role },
    create: { userId, tenantId, role },
  });
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-tenant" },
    update: {},
    create: { slug: "demo-tenant", name: "Demo Tenant" },
  });

  const superAdmin = await ensureUser("superadmin@nexid.lat", "Super Admin Demo");
  const tenantAdmin = await ensureUser("tenantadmin@nexid.lat", "Tenant Admin Demo");
  const reseller = await ensureUser("reseller@nexid.lat", "Reseller Demo");
  const viewer = await ensureUser("viewer@nexid.lat", "Viewer Demo");

  await Promise.all([
    ensureMembership(superAdmin.id, tenant.id, Role.super_admin),
    ensureMembership(tenantAdmin.id, tenant.id, Role.tenant_admin),
    ensureMembership(reseller.id, tenant.id, Role.reseller),
    ensureMembership(viewer.id, tenant.id, Role.viewer),
  ]);

  await prisma.knowledgeArticle.upsert({
    where: { locale_slug: { locale: "es-AR", slug: "getting-started" } },
    update: { title: "Qué es nexID", body: "nexID protege productos con NFC + identidad digital." },
    create: { locale: "es-AR", slug: "getting-started", title: "Qué es nexID", body: "nexID protege productos con NFC + identidad digital." },
  });

  await prisma.knowledgeArticle.upsert({
    where: { locale_slug: { locale: "en", slug: "pricing-roi" } },
    update: { title: "Pricing and ROI", body: "Quote inputs: volume, tag type, and SaaS plan." },
    create: { locale: "en", slug: "pricing-roi", title: "Pricing and ROI", body: "Quote inputs: volume, tag type, and SaaS plan." },
  });

  console.log("Prisma seed ready with demo RBAC users and tenant.");
}

main().finally(async () => prisma.$disconnect());
