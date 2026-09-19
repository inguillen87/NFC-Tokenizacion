"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Building2, CircleAlert, Gift, History, Mail, Package, ScanLine, ShieldCheck, ShoppingBag, UserRound, Wallet } from "lucide-react";
import { homeMembershipLabel, homeVerdictLabel, type ConsumerHomeModel, type HomeProduct } from "./consumer-home-model";
import styles from "./consumer-home.module.css";

export function ConsumerProductImage({ product, className = "" }: { product: HomeProduct; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <span className={`${styles.productImage} ${className}`}>{product.imageUrl && !failed
    ? <Image src={product.imageUrl} alt={product.name} width={104} height={112} sizes="104px" unoptimized onError={() => setFailed(true)} />
    : <Package size={28} aria-hidden="true" />}</span>;
}

export function ConsumerDataRetryButton() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  return <button type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "Consultando…" : "Reintentar carga"}</button>;
}

function SectionHeading({ id, title, href, link }: { id: string; title: string; href: string; link: string }) {
  return <div className={styles.sectionHeading}><h2 id={id}>{title}</h2><Link href={href}>{link}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>;
}

function SectionState({ unavailable, children }: { unavailable?: boolean; children: ReactNode }) {
  return <div className={unavailable ? styles.unavailable : styles.empty}>{unavailable && <CircleAlert size={20} aria-hidden="true" />}<div>{children}</div></div>;
}

export function MePortalInteractiveClient({ model }: { model: ConsumerHomeModel }) {
  const account = model.account.status === "ready" ? model.account.data : null;
  const hasUnavailable = Object.values(model).some((source) => source.status === "unavailable");
  return (
    <div className={styles.home} data-testid="consumer-home">
      <section className={styles.welcome} aria-labelledby="home-welcome-title">
        <div className={styles.welcomeCopy}>
          <span className={styles.eyebrow}>Un espacio para lo que elegís</span>
          <h2 id="home-welcome-title">{account?.name ? `Hola, ${account.name}.` : "Tu cuenta"}</h2>
          <p>La información de tus productos y tus vínculos con las marcas, siempre a mano.</p>
          <Link className={styles.primaryAction} href="/me/products">Ver mis productos<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <nav className={styles.quickLinks} aria-label="Accesos de tu cuenta">
          <Link href="/me/products"><span className={styles.quickIcon}><Package size={22} aria-hidden="true" /></span><span><strong>Productos guardados</strong><small>{account?.products != null ? `${account.products} en tu cuenta` : "Tu colección de productos"}</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
          <Link href="/me/taps"><span className={styles.quickIcon}><History size={22} aria-hidden="true" /></span><span><strong>Historial de lecturas</strong><small>{account?.taps != null ? `${account.taps} registradas en tu cuenta` : "Volvé a una lectura anterior"}</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
          <Link href="/me/rewards"><span className={styles.quickIcon}><Gift size={22} aria-hidden="true" /></span><span><strong>Mis beneficios</strong><small>Consultá condiciones y vigencia</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
        </nav>
      </section>

      {hasUnavailable && <div className={styles.loadNotice} role="status">
        <CircleAlert size={20} aria-hidden="true" /><p><strong>No pudimos cargar algunos datos.</strong> Las secciones disponibles se mantienen visibles.</p>
        <ConsumerDataRetryButton />
      </div>}

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby="home-products-title">
            <SectionHeading id="home-products-title" title="Tus productos" href="/me/products" link="Ver todos" />
            {model.products.status === "unavailable" ? <SectionState unavailable><strong>No se pudieron cargar tus productos.</strong><p>Reintentá la carga para consultar tu colección.</p></SectionState>
              : model.products.data.length === 0 ? <SectionState><span className={styles.emptyIcon}><Package size={28} aria-hidden="true" /></span><strong>Tu próximo producto empieza con un tap.</strong><p>Acercá el teléfono a una etiqueta NFC o escaneá el QR del producto. Desde su pasaporte podés vincular la lectura a tu cuenta.</p><Link className={styles.textAction} href="/me/products">Ver cómo empezar<ArrowRight size={16} aria-hidden="true" /></Link></SectionState>
              : <ul className={styles.productList}>{model.products.data.slice(0, 4).map((product, index) => <li key={`${product.readingHref || product.batch || product.name}-${index}`} className={styles.productCard}>
                <ConsumerProductImage product={product} /><div className={styles.productContent}>
                  <span className={styles.itemEyebrow}>{product.brand || "Marca no informada"}</span><h3>{product.name}</h3>
                  {product.batch && <p className={styles.metadata}>Lote {product.batch}</p>}
                  <Link prefetch={false} className={styles.textAction} href={product.eventId ? `/me/products?focus=${encodeURIComponent(product.eventId)}` : "/me/products"}>{product.eventId ? "Abrir ficha y avisos" : "Ver producto guardado"}<ArrowRight size={16} aria-hidden="true" /></Link>{product.readingHref&&<Link prefetch={false} className={styles.textAction} href={product.readingHref}>Abrir lectura<ArrowUpRight size={14} aria-hidden="true"/></Link>}
                </div>
              </li>)}</ul>}
          </section>

          <section className={styles.panel} aria-labelledby="home-taps-title">
            <SectionHeading id="home-taps-title" title="Últimas lecturas" href="/me/taps" link="Ver historial" />
            {model.taps.status === "unavailable" ? <SectionState unavailable><strong>No se pudo cargar el historial.</strong><p>Esto no significa que no tengas lecturas guardadas.</p></SectionState>
              : model.taps.data.length === 0 ? <SectionState><span className={styles.emptyIcon}><ScanLine size={28} aria-hidden="true" /></span><strong>Aún no hay lecturas vinculadas.</strong><p>Las lecturas que asocies a esta cuenta aparecerán acá. Podrás volver a su información sin buscar de nuevo la etiqueta.</p></SectionState>
              : <><ul className={styles.tapList}>{model.taps.data.slice(0, 5).map((tap, index) => <li key={`${tap.id || "reading"}-${index}`}>
                <span className={styles.tapIcon}><ScanLine size={20} aria-hidden="true" /></span><div className={styles.tapContent}>
                  <span className={styles.itemEyebrow}>{tap.brand || "Marca no informada"}</span><h3>{homeVerdictLabel(tap.verdict)}</h3>
                  <p className={styles.metadata}>{tap.location || "Zona no reportada"}</p>
                  {tap.dateTime ? <time dateTime={tap.dateTime}>{tap.date}</time> : <span className={styles.metadata}>{tap.date}</span>}
                </div>
                <Link className={styles.readingAction} href={tap.href || "/me/taps"} aria-label={tap.id ? `Abrir lectura ${tap.id}` : "Consultar lectura en el historial"}><span>Ver lectura</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
              </li>)}</ul><p className={styles.footnote}>Hasta 5 lecturas recientes. Horarios en UTC; no representan la zona horaria del teléfono.</p></>}
          </section>
        </div>

        <aside className={styles.sideColumn} aria-label="Marcas y cuenta">
          <section className={styles.panel} aria-labelledby="home-brands-title">
            <SectionHeading id="home-brands-title" title="Tus marcas y clubes" href="/me/brands" link="Ver todos" />
            {model.brands.status === "unavailable" ? <SectionState unavailable><strong>No pudimos consultar tus membresías.</strong><p>Reintentá para ver sus estados y puntos reportados.</p></SectionState>
              : model.brands.data.length === 0 ? <SectionState><span className={styles.emptyIcon}><Building2 size={26} aria-hidden="true" /></span><strong>Elegí con qué marcas conectar.</strong><p>Cuando te sumes a un club, su membresía aparecerá en este espacio.</p><Link className={styles.textAction} href="/me/brands">Explorar mis marcas<ArrowRight size={16} aria-hidden="true" /></Link></SectionState>
              : <ul className={styles.brandList}>{model.brands.data.slice(0, 3).map((brand, index) => <li key={`${brand.href}-${index}`}>
                <div className={styles.brandTitle}><span className={styles.brandIcon}><Building2 size={20} aria-hidden="true" /></span><div><h3>{brand.name}</h3><p className={styles.metadata}>{homeMembershipLabel(brand.status)}</p></div></div>
                <div className={styles.brandFooter}><span>{brand.points != null ? <><strong>{brand.points}</strong> puntos reportados</> : "Puntos no informados"}</span><Link href={brand.href} aria-label={`Ver opciones de ${brand.name}`}>Ver opciones<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
              </li>)}</ul>}
          </section>

          <section className={styles.benefitCard} aria-labelledby="home-benefits-title">
            <span className={styles.benefitIcon}><Gift size={24} aria-hidden="true" /></span><span className={styles.eyebrow}>Seguí explorando</span><h2 id="home-benefits-title">Más de tus marcas.</h2>
            <p>Revisá tus beneficios o descubrí el catálogo publicado por cada empresa.</p>
            <Link className={styles.primaryAction} href="/me/rewards">Consultar beneficios<ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className={styles.textAction} href="/me/marketplace"><ShoppingBag size={17} aria-hidden="true" />Explorar catálogo<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </section>

          <section className={styles.panel} aria-labelledby="home-account-title">
            <div className={styles.sectionHeading}><h2 id="home-account-title">Tu cuenta</h2><UserRound size={20} aria-hidden="true" /></div>
            {model.account.status === "unavailable" ? <SectionState unavailable><strong>No se pudieron cargar tus datos.</strong><p>Reintentá para consultar el correo y el estado de tu cuenta.</p></SectionState>
              : <div className={styles.accountDetails}><span className={styles.itemEyebrow}>Correo de tu cuenta</span><p className={styles.accountEmail}><Mail size={16} aria-hidden="true" />{account?.email || "Correo no informado"}</p><p className={styles.metadata}>Estado: {account?.status === "verified" ? "verificada" : account?.status === "active" ? "activa" : account?.status || "no informado"}</p></div>}
            <nav className={styles.accountLinks} aria-label="Gestionar tu cuenta">
              <Link href="/me/privacy"><ShieldCheck size={18} aria-hidden="true" /><span>Privacidad y permisos</span><ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/me/security"><UserRound size={18} aria-hidden="true" /><span>Seguridad de la cuenta</span><ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/me/wallet"><Wallet size={18} aria-hidden="true" /><span>Mi wallet</span><ArrowRight size={16} aria-hidden="true" /></Link>
            </nav>
          </section>
        </aside>
      </div>
    </div>
  );
}
