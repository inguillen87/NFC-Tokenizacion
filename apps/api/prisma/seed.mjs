import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "superadmin@nexid.lat" },
    update: {},
    create: { email: "superadmin@nexid.lat", fullName: "Super Admin" },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-tenant" },
    update: {},
    create: { slug: "demo-tenant", name: "Demo Tenant" },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: tenant.id } },
    update: { role: Role.super_admin },
    create: { userId: admin.id, tenantId: tenant.id, role: Role.super_admin },
  });

  await prisma.knowledgeArticle.upsert({
    where: { locale_slug: { locale: "es-AR", slug: "getting-started" } },
    update: { title: "Qué es nexID", body: "nexID protege productos con NFC + identidad digital." },
    create: { locale: "es-AR", slug: "getting-started", title: "Qué es nexID", body: "nexID protege productos con NFC + identidad digital." },
  });
}

main().finally(async () => prisma.$disconnect());
