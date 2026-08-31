"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, ExternalLink, Menu, X } from "lucide-react";
import { LocaleSwitcher, ThemeToggle, type Theme } from "@product/ui";
import type { AppLocale } from "@product/config";
import { BrandHomeLink } from "./brand-home-link";
import styles from "./marketing-mega-nav.module.css";

type NavItem = {
  label: string;
  description: string;
  href: string;
  badge?: string;
  external?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  featured: NavItem;
  items: NavItem[];
};

type NavigationCopy = {
  ariaLabel: string;
  login: string;
  demo: string;
  menu: string;
  close: string;
  groups: NavGroup[];
};

type MarketingMegaNavProps = {
  locale: AppLocale;
  locales: readonly AppLocale[];
  initialTheme: Theme;
  loginHref: string;
  meetingHref: string;
};

function getNavigationCopy(locale: AppLocale, meetingHref: string): NavigationCopy {
  if (locale === "en") {
    return {
      ariaLabel: "Main navigation",
      login: "Sign in",
      demo: "Book a demo",
      menu: "Open navigation",
      close: "Close navigation",
      groups: [
        {
          id: "solutions",
          label: "Solutions",
          eyebrow: "By business need",
          description: "Start with the outcome you need. The technical depth stays available when you want it.",
          featured: { label: "Design your pilot", description: "Scope, carriers and rollout economics in one place.", href: "/pricing" },
          items: [
            { label: "Product identity and protection", description: "Validate tag evidence without treating it as proof of the physical object.", href: "/demo-lab?scenario=nfc-424" },
            { label: "Traceability and evidence", description: "Connect declared events, controls and public proofs.", href: "/demo-lab?scenario=dual-proof" },
            { label: "Digital passport", description: "Open provenance, warranty and ownership experiences.", href: "/demo-lab?scenario=polygon-ownership" },
            { label: "Loyalty and engagement", description: "Turn a tap into service, benefits and repeat purchase.", href: "/demo-lab?scenario=qr-gs1" },
            { label: "Plans and pilots", description: "Compare a controlled pilot, scalable rollout and enterprise scope.", href: "/pricing" },
          ],
        },
        {
          id: "industries",
          label: "Industries",
          eyebrow: "Ready-to-explore journeys",
          description: "See the same platform adapted to the language and operating reality of each industry.",
          featured: { label: "Explore every industry", description: "Compare all guided product journeys in Demo Lab.", href: "/demo-lab" },
          items: [
            { label: "Wine and beverages", description: "Origin, opening evidence and direct-to-consumer service.", href: "/demo-lab?vertical=wine" },
            { label: "Luxury and beauty", description: "Tag evidence, ownership and premium after-sales.", href: "/demo-lab?vertical=perfume" },
            { label: "Pharma and health", description: "Controlled evidence and guided safety information.", href: "/demo-lab?vertical=pharma" },
            { label: "Agro and seeds", description: "Batch context, channel controls and field verification.", href: "/demo-lab?vertical=seeds" },
            { label: "Logistics", description: "Declared milestones, exceptions and operational handoffs.", href: "/demo-lab?vertical=logistics" },
            { label: "Events", description: "Access, benefits and post-event digital experiences.", href: "/demo-lab?vertical=bracelet" },
          ],
        },
        {
          id: "platform",
          label: "Platform",
          eyebrow: "See how nexID works",
          description: "Move from a guided experience to proof tools, field mode and integration surfaces.",
          featured: { label: "Guided experience", description: "See the complete consumer and operator flow.", href: "/demo" },
          items: [
            { label: "Demo Lab", description: "Run transparent, scope-labelled product scenarios.", href: "/demo-lab" },
            { label: "Verify public evidence", description: "Check public evidence without exposing private data.", href: "/proof/verify" },
            { label: "NFC security", description: "Review fresh-message validation for provisioned NFC tags.", href: "/sun" },
            { label: "Offline field mode", description: "Review the controlled workflow for low-connectivity sites.", href: "/offline" },
            { label: "Consumer portal", description: "Access passports, certificates, rewards and ownership.", href: "/login?next=/me" },
            { label: "SDK and APIs", description: "Integrate the platform when your technical team is ready.", href: "/sdk" },
          ],
        },
        {
          id: "resources",
          label: "Resources",
          eyebrow: "Go deeper without crowding the home",
          description: "Commercial, technical and institutional material now has a clear place of its own.",
          featured: { label: "Talk to a specialist", description: "Review your use case and define the next useful step.", href: meetingHref, external: true },
          items: [
            { label: "About us", description: "Meet nexID, the Inmovar Latam ecosystem and its founder.", href: "/about" },
            { label: "Documentation", description: "Guides, operating concepts and frequently asked questions.", href: "/docs" },
            { label: "Architecture", description: "Understand the platform layers and technology choices.", href: "/stack" },
            { label: "Glossary", description: "Plain-language definitions for physical and digital concepts.", href: "/glossary" },
            { label: "By audience", description: "A focused view for brands, resellers and institutions.", href: "/audiences" },
            { label: "Reseller program", description: "Explore the partner model and regional rollout.", href: "/resellers" },
          ],
        },
      ],
    };
  }

  if (locale === "pt-BR") {
    return {
      ariaLabel: "Navegação principal",
      login: "Entrar",
      demo: "Agendar demo",
      menu: "Abrir navegação",
      close: "Fechar navegação",
      groups: [
        {
          id: "solutions",
          label: "Soluções",
          eyebrow: "Por necessidade de negócio",
          description: "Comece pelo resultado que você busca. A profundidade técnica continua disponível quando precisar.",
          featured: { label: "Desenhe seu piloto", description: "Escopo, carriers e economia do rollout em um só lugar.", href: "/pricing" },
          items: [
            { label: "Identidade e proteção do produto", description: "Valide a evidência do tag sem tratá-la como prova do objeto físico.", href: "/demo-lab?scenario=nfc-424" },
            { label: "Rastreabilidade e evidência", description: "Conecte eventos declarados, controles e provas públicas.", href: "/demo-lab?scenario=dual-proof" },
            { label: "Passaporte digital", description: "Abra experiências de origem, garantia e ownership.", href: "/demo-lab?scenario=polygon-ownership" },
            { label: "Fidelização e experiência", description: "Transforme um tap em serviço, benefícios e recompra.", href: "/demo-lab?scenario=qr-gs1" },
            { label: "Planos e pilotos", description: "Compare piloto controlado, rollout escalável e escopo enterprise.", href: "/pricing" },
          ],
        },
        {
          id: "industries",
          label: "Indústrias",
          eyebrow: "Jornadas prontas para explorar",
          description: "Veja a plataforma adaptada à linguagem e à operação de cada setor.",
          featured: { label: "Explorar todos os setores", description: "Compare todas as jornadas guiadas no Demo Lab.", href: "/demo-lab" },
          items: [
            { label: "Vinhos e bebidas", description: "Origem, evidência de abertura e serviço direto.", href: "/demo-lab?vertical=wine" },
            { label: "Luxo e beleza", description: "Evidência da etiqueta, ownership e pós-venda premium.", href: "/demo-lab?vertical=perfume" },
            { label: "Farma e saúde", description: "Evidência controlada e informação de segurança guiada.", href: "/demo-lab?vertical=pharma" },
            { label: "Agro e sementes", description: "Contexto de lote, controle de canal e verificação em campo.", href: "/demo-lab?vertical=seeds" },
            { label: "Logística", description: "Marcos declarados, exceções e passagens operacionais.", href: "/demo-lab?vertical=logistics" },
            { label: "Eventos", description: "Acesso, benefícios e experiências digitais pós-evento.", href: "/demo-lab?vertical=bracelet" },
          ],
        },
        {
          id: "platform",
          label: "Plataforma",
          eyebrow: "Veja como nexID funciona",
          description: "Passe da experiência guiada para provas, modo de campo e integrações.",
          featured: { label: "Experiência guiada", description: "Veja o fluxo completo para consumidor e operador.", href: "/demo" },
          items: [
            { label: "Demo Lab", description: "Execute cenários transparentes com escopo declarado.", href: "/demo-lab" },
            { label: "Verificar evidência pública", description: "Confira evidência pública sem expor dados privados.", href: "/proof/verify" },
            { label: "Segurança NFC", description: "Revise a validação de mensagens frescas em tags NFC provisionadas.", href: "/sun" },
            { label: "Modo de campo offline", description: "Revise o fluxo controlado para locais sem conectividade.", href: "/offline" },
            { label: "Portal do consumidor", description: "Acesse passaportes, certificados, benefícios e ownership.", href: "/login?next=/me" },
            { label: "SDK e APIs", description: "Integre a plataforma quando sua equipe técnica estiver pronta.", href: "/sdk" },
          ],
        },
        {
          id: "resources",
          label: "Recursos",
          eyebrow: "Aprofunde sem sobrecarregar a home",
          description: "O material comercial, técnico e institucional agora tem um lugar claro.",
          featured: { label: "Falar com um especialista", description: "Revise seu caso e defina o próximo passo útil.", href: meetingHref, external: true },
          items: [
            { label: "Quem somos", description: "Conheça a nexID, o ecossistema Inmovar Latam e seu fundador.", href: "/about" },
            { label: "Documentação", description: "Guias, conceitos operacionais e perguntas frequentes.", href: "/docs" },
            { label: "Arquitetura", description: "Entenda as camadas e escolhas tecnológicas da plataforma.", href: "/stack" },
            { label: "Glossário", description: "Definições claras para conceitos físicos e digitais.", href: "/glossary" },
            { label: "Por audiência", description: "Uma visão focada para marcas, revendas e instituições.", href: "/audiences" },
            { label: "Programa reseller", description: "Explore o modelo de parceiros e rollout regional.", href: "/resellers" },
          ],
        },
      ],
    };
  }

  return {
    ariaLabel: "Navegación principal",
    login: "Ingresar",
    demo: "Agendar demo",
    menu: "Abrir navegación",
    close: "Cerrar navegación",
    groups: [
      {
        id: "solutions",
        label: "Soluciones",
        eyebrow: "Por necesidad de negocio",
        description: "Empezá por el resultado que buscás. La profundidad técnica sigue disponible cuando la necesitás.",
        featured: { label: "Diseñá tu piloto", description: "Alcance, soportes y economía del despliegue en un solo lugar.", href: "/pricing" },
        items: [
          { label: "Identidad y protección de producto", description: "Validá la evidencia del tag sin tratarla como prueba del objeto físico.", href: "/demo-lab?scenario=nfc-424" },
          { label: "Trazabilidad y evidencia", description: "Conectá eventos declarados, controles y pruebas públicas.", href: "/demo-lab?scenario=dual-proof" },
          { label: "Pasaporte digital", description: "Abrí experiencias de origen, garantía y propiedad.", href: "/demo-lab?scenario=polygon-ownership" },
          { label: "Fidelización y experiencia", description: "Convertí un toque en servicio, beneficios y recompra.", href: "/demo-lab?scenario=qr-gs1" },
          { label: "Planes y pilotos", description: "Compará un piloto controlado, un despliegue escalable y el alcance enterprise.", href: "/pricing" },
        ],
      },
      {
        id: "industries",
        label: "Industrias",
        eyebrow: "Recorridos listos para explorar",
        description: "Mirá la misma plataforma adaptada al lenguaje y la operación de cada sector.",
        featured: { label: "Explorar todas las industrias", description: "Compará todos los recorridos guiados en Demo Lab.", href: "/demo-lab" },
        items: [
          { label: "Vinos y bebidas", description: "Origen, evidencia de apertura y servicio directo al cliente.", href: "/demo-lab?vertical=wine" },
          { label: "Lujo y belleza", description: "Evidencia de etiqueta, propiedad y posventa premium.", href: "/demo-lab?vertical=perfume" },
          { label: "Farma y salud", description: "Evidencia controlada e información de seguridad guiada.", href: "/demo-lab?vertical=pharma" },
          { label: "Agro y semillas", description: "Contexto de lote, control de canal y verificación en campo.", href: "/demo-lab?vertical=seeds" },
          { label: "Logística", description: "Hitos declarados, excepciones y traspasos operativos.", href: "/demo-lab?vertical=logistics" },
          { label: "Eventos", description: "Acceso, beneficios y experiencias digitales posteriores.", href: "/demo-lab?vertical=bracelet" },
        ],
      },
      {
        id: "platform",
        label: "Plataforma",
        eyebrow: "Mirá cómo funciona nexID",
        description: "Pasá de una experiencia guiada a las pruebas, el modo de campo y las integraciones.",
        featured: { label: "Experiencia guiada", description: "Mirá el flujo completo para cliente y operador.", href: "/demo" },
        items: [
          { label: "Demo Lab", description: "Probá escenarios transparentes con alcance declarado.", href: "/demo-lab" },
          { label: "Verificar evidencia pública", description: "Comprobá evidencia pública sin exponer datos privados.", href: "/proof/verify" },
          { label: "Seguridad NFC", description: "Revisá la validación de mensajes frescos en tags NFC provisionados.", href: "/sun" },
          { label: "Modo de campo offline", description: "Revisá el flujo controlado para lugares sin conectividad.", href: "/offline" },
          { label: "Portal del consumidor", description: "Accedé a pasaportes, certificados, beneficios y propiedad.", href: "/login?next=/me" },
          { label: "SDK y APIs", description: "Integrá la plataforma cuando tu equipo técnico esté listo.", href: "/sdk" },
        ],
      },
      {
        id: "resources",
        label: "Recursos",
        eyebrow: "Profundizá sin cargar la portada",
        description: "El material comercial, técnico e institucional ahora tiene un lugar claro y ordenado.",
        featured: { label: "Hablar con un especialista", description: "Revisá tu caso y definí el próximo paso útil.", href: meetingHref, external: true },
        items: [
          { label: "Quiénes somos", description: "Conocé nexID, el ecosistema Inmovar Latam y a su fundador.", href: "/about" },
          { label: "Documentación", description: "Guías, conceptos operativos y preguntas frecuentes.", href: "/docs" },
          { label: "Arquitectura", description: "Entendé las capas y decisiones tecnológicas de la plataforma.", href: "/stack" },
          { label: "Glosario", description: "Definiciones claras para conceptos físicos y digitales.", href: "/glossary" },
          { label: "Por audiencia", description: "Una vista enfocada para marcas, resellers e instituciones.", href: "/audiences" },
          { label: "Programa reseller", description: "Explorá el modelo de partners y despliegue regional.", href: "/resellers" },
        ],
      },
    ],
  };
}

const navigationGroupPathPrefixes: Record<string, readonly string[]> = {
  solutions: ["/pricing"],
  industries: [],
  platform: ["/demo", "/demo-lab", "/proof", "/sun", "/offline", "/login", "/sdk"],
  resources: ["/about", "/docs", "/stack", "/glossary", "/audiences", "/resellers"],
};

function isNavigationGroupCurrent(groupId: string, pathname: string) {
  return (navigationGroupPathPrefixes[groupId] ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function MenuLink({ item, currentPath, featured = false, onNavigate }: { item: NavItem; currentPath: string; featured?: boolean; onNavigate?: () => void }) {
  const itemPath = item.href.split(/[?#]/)[0];
  const isCurrent = !item.external && !/[?#]/.test(item.href) && itemPath !== "/" && currentPath === itemPath;
  const className = featured ? `${styles.menuItem} ${styles.featuredItem}` : styles.menuItem;
  const content = (
    <>
      <span className={styles.menuItemCopy}>
        <span className={styles.menuItemTitle}>
          {item.label}
          {item.badge ? <small>{item.badge}</small> : null}
        </span>
        <span className={styles.menuItemDescription}>{item.description}</span>
      </span>
      {item.external ? <ExternalLink aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
    </>
  );

  if (item.external) {
    return <a href={item.href} target="_blank" rel="noreferrer" className={className} data-menu-link onClick={onNavigate}>{content}</a>;
  }

  return (
    <Link href={item.href} className={className} data-menu-link aria-current={isCurrent ? "page" : undefined} onClick={onNavigate}>
      {content}
    </Link>
  );
}

export function MarketingMegaNav({ locale, locales, initialTheme, loginHref, meetingHref }: MarketingMegaNavProps) {
  const pathname = usePathname();
  const copy = getNavigationCopy(locale, meetingHref);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimerRef = useRef<number | null>(null);
  const openMenuSourceRef = useRef<"hover" | "click" | null>(null);

  function cancelScheduledClose() {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function openDesktopMenu(groupId: string, source: "hover" | "click") {
    cancelScheduledClose();
    openMenuSourceRef.current = source;
    setOpenMenu(groupId);
  }

  function closeDesktopMenu() {
    cancelScheduledClose();
    openMenuSourceRef.current = null;
    setOpenMenu(null);
  }

  function handleDesktopMenuEnter(event: ReactPointerEvent<HTMLDivElement>, groupId: string) {
    if (event.pointerType !== "mouse") return;
    if (openMenu === groupId && openMenuSourceRef.current === "click") {
      cancelScheduledClose();
      return;
    }
    openDesktopMenu(groupId, "hover");
  }

  function scheduleDesktopMenuClose(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    if (openMenuSourceRef.current === "click") return;
    const groupElement = event.currentTarget;
    cancelScheduledClose();
    if (groupElement.contains(document.activeElement)) return;
    closeTimerRef.current = window.setTimeout(() => {
      if (groupElement.contains(document.activeElement)) {
        closeTimerRef.current = null;
        return;
      }
      openMenuSourceRef.current = null;
      setOpenMenu(null);
      closeTimerRef.current = null;
    }, 340);
  }

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMobileOpen(false);
    openMenuSourceRef.current = null;
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-inert]"));
    const previousAria = inertTargets.map((target) => target.getAttribute("aria-hidden"));
    document.body.style.overflow = "hidden";
    inertTargets.forEach((target) => {
      target.setAttribute("inert", "");
      target.setAttribute("aria-hidden", "true");
    });

    const frame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        mobileDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select, summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      inertTargets.forEach((target, index) => {
        target.removeAttribute("inert");
        const ariaValue = previousAria[index];
        if (ariaValue === null) target.removeAttribute("aria-hidden");
        else target.setAttribute("aria-hidden", ariaValue);
      });
      mobileTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!openMenu) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || navigationRef.current?.contains(target)) return;
      closeDesktopMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const groupId = openMenu;
      if (!groupId) return;
      closeDesktopMenu();
      window.requestAnimationFrame(() => groupButtonRefs.current[groupId]?.focus());
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  function openAndFocus(groupId: string) {
    openDesktopMenu(groupId, "click");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-mega-nav-group="${groupId}"] [data-menu-link]`)?.focus();
    });
  }

  return (
    <div ref={navigationRef} className={styles.navigation}>
      <nav className={styles.desktopNav} aria-label={copy.ariaLabel}>
        {copy.groups.map((group) => {
          const expanded = openMenu === group.id;
          const groupCurrent = isNavigationGroupCurrent(group.id, pathname);
          return (
            <div
              key={group.id}
              className={styles.navGroup}
              data-mega-nav-group={group.id}
              onPointerEnter={(event) => handleDesktopMenuEnter(event, group.id)}
              onPointerLeave={scheduleDesktopMenuClose}
              onFocus={cancelScheduledClose}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) closeDesktopMenu();
              }}
            >
              <button
                ref={(element) => {
                  groupButtonRefs.current[group.id] = element;
                }}
                type="button"
                className={styles.navGroupButton}
                aria-expanded={expanded}
                aria-current={groupCurrent ? "page" : undefined}
                aria-haspopup="true"
                aria-controls={`mega-menu-${group.id}`}
                onClick={() => {
                  if (expanded && openMenuSourceRef.current === "click") closeDesktopMenu();
                  else openDesktopMenu(group.id, "click");
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    openAndFocus(group.id);
                  }
                }}
              >
                {group.label}
                <ChevronDown aria-hidden="true" />
              </button>

              {expanded ? (
                <div id={`mega-menu-${group.id}`} className={styles.megaMenu}>
                  <div className={styles.megaMenuIntro}>
                    <span>{group.eyebrow}</span>
                    <p>{group.description}</p>
                    <MenuLink item={group.featured} currentPath={pathname} featured onNavigate={closeDesktopMenu} />
                  </div>
                  <div className={styles.megaMenuGrid}>
                    {group.items.map((item) => (
                      <MenuLink key={`${group.id}-${item.href}`} item={item} currentPath={pathname} onNavigate={closeDesktopMenu} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={styles.headerUtilities}>
        <div className={styles.desktopUtility}><LocaleSwitcher value={locale} options={[...locales]} /></div>
        <div className={styles.desktopUtility}><ThemeToggle initialTheme={initialTheme} locale={locale} /></div>
        <a href={loginHref} className={styles.loginLink}>{copy.login}</a>
        <Link href="/?contact=demo#contact-modal" className={styles.headerCta}>{copy.demo}</Link>
        <button
          ref={mobileTriggerRef}
          type="button"
          className={styles.mobileMenuButton}
          aria-label={copy.menu}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
      </div>

      {mobileOpen ? (
        <div className={styles.mobileOverlay}>
          <button type="button" tabIndex={-1} aria-hidden="true" className={styles.mobileScrim} onClick={() => setMobileOpen(false)} />
          <div ref={mobileDialogRef} className={styles.mobileDialog} role="dialog" aria-modal="true" aria-label={copy.menu}>
            <div className={styles.mobileDialogHead}>
              <BrandHomeLink
                locale={locale}
                size={40}
                brandClassName="mobile-menu-brand"
                className={styles.mobileDialogBrand}
                onNavigate={() => setMobileOpen(false)}
              />
              <button ref={mobileCloseRef} type="button" aria-label={copy.close} onClick={() => setMobileOpen(false)}><X aria-hidden="true" /></button>
            </div>

            <div className={styles.mobileGroups}>
              {copy.groups.map((group, index) => (
                <details key={group.id} open={index === 0} className={styles.mobileGroup}>
                  <summary>
                    <span><strong>{group.label}</strong><small>{group.eyebrow}</small></span>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className={styles.mobileGroupItems}>
                    {group.items.map((item) => (
                      <MenuLink key={`${group.id}-mobile-${item.href}`} item={item} currentPath={pathname} onNavigate={() => setMobileOpen(false)} />
                    ))}
                    <MenuLink item={group.featured} currentPath={pathname} featured onNavigate={() => setMobileOpen(false)} />
                  </div>
                </details>
              ))}
            </div>

            <div className={styles.mobileUtilities}>
              <LocaleSwitcher value={locale} options={[...locales]} />
              <ThemeToggle initialTheme={initialTheme} locale={locale} />
            </div>
            <div className={styles.mobileActions}>
              <a href={loginHref}>{copy.login}</a>
              <Link href="/?contact=demo#contact-modal" onClick={() => setMobileOpen(false)}>{copy.demo}</Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
