import type { DashboardCopy } from "../types";
import { esAR } from "./es-AR";

export const ptBR: DashboardCopy = {
  ...esAR,
  shell: { subtitle: "Controle enterprise multi-tenant", search: "Buscar módulos...", role: "Papel", logout: "Sair", apiConnected: "API conectada", loading: "Carregando dados...", empty: "Sem resultados" },
  nav: { overview: "Visão geral", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analytics", events: "Eventos", resellers: "Revendedores", subscriptions: "Assinaturas", apiKeys: "API Keys" },
  pages: {
    overview: { title: "Visão operacional", description: "KPIs críticos de autenticação, fraude e operação." },
    tenants: { title: "Gestão de tenants", description: "Clientes, planos e saúde operacional por tenant." },
    batches: { title: "Gestão de lotes", description: "Criar lote, importar manifest, ativar tags e revogar." },
    tags: { title: "Gestão de tags", description: "Inventário, perfil secure/basic e cobertura de ativação." },
    analytics: { title: "Analytics antifraude", description: "Total scans, valid/invalid, duplicates, tamper e geo placeholder." },
    events: { title: "Eventos", description: "Tabela pesquisável com filtros e badges de status." },
    resellers: { title: "Canal revendedor", description: "Performance de parceiros e receita de canal." },
    subscriptions: { title: "Assinaturas", description: "Planos ativos, renovações e expansão de receita." },
    apiKeys: { title: "Developer settings", description: "Escopo e rotação de credenciais API." },
  },
  table: { ...esAR.table, search: "Buscar", all: "Todos", refresh: "Atualizar", columns: { ...esAR.table.columns, country: "País", qty: "Quantidade", time: "Hora", renewal: "Renovação", lastUsed: "Último uso" } },
  kpis: { ...esAR.kpis, activeBatches: "Lotes ativos", activeTenants: "Tenants ativos", resellerPerformance: "Performance revendedor", geoDistribution: "Distribuição geo", trendTitle: "Tendência de segurança", statusTitle: "Status de lotes" },
  forms: { ...esAR.forms, roleHeading: "Operações por papel", roleLabel: "Papel ativo", roleHint: { "super-admin": "Acesso global a tenants, lotes e parceiros.", "tenant-admin": "Operação no nível do tenant.", reseller: "Operação de subclientes e white-label.", viewer: "Somente leitura para analytics e eventos." }, fields: { ...esAR.forms.fields, tenantName: "Nome do tenant", quantity: "Quantidade", reason: "Motivo" }, actions: { createTenant: "Criar tenant", createBatch: "Criar lote", importManifest: "Importar manifest", activateTags: "Ativar tags", revokeBatch: "Revogar lote" } },
  auth: { loginTitle: "Entrar", loginBody: "Portal seguro para super admin, tenant admin, reseller e viewer.", registerTitle: "Criar organização", registerBody: "Criar workspace para operações NFC enterprise.", forgotTitle: "Esqueci a senha", forgotBody: "Enviaremos um link seguro de recuperação.", email: "Email corporativo", password: "Senha", company: "Empresa", tenantSlug: "Tenant slug", sendLink: "Enviar link" },
};
