import Link from "next/link";
import { cookies } from "next/headers";
import { ThemeToggle } from "@product/ui";
import { THEME_PREFERENCE_VERSION_COOKIE, resolveThemePreference } from "@product/ui/theme-preference";
import { BackLink } from "../../components/back-link";
import { getWebI18n } from "../../lib/locale";
import styles from "../login/consumer-login.module.css";

const copy = {
  "es-AR": { title: "Tu espacio en nexID", intro: "Elegí cómo querés comenzar. Cada acceso conserva los permisos de su espacio.", client: "Tengo un producto", detail: "Entrá con un código por email o teléfono para consultar tus productos y beneficios. No necesitás contraseña.", action: "Acceder a mi Pasaporte →", company: "Represento a una empresa", companyDetail: "Conocé nexID y coordiná el acceso para tu equipo y tu marca.", companyAction: "Contactar a nexID →" },
  en: { title: "Your space in nexID", intro: "Choose how to get started. Each space keeps its own permissions.", client: "I have a product", detail: "Use an email or phone code to access your products and benefits. No password needed.", action: "Access my Passport →", company: "I represent a business", companyDetail: "Discover nexID and arrange access for your team and brand.", companyAction: "Contact nexID →" },
  "pt-BR": { title: "Seu espaço na nexID", intro: "Escolha como começar. Cada espaço mantém suas próprias permissões.", client: "Tenho um produto", detail: "Entre com um código por email ou telefone para consultar produtos e benefícios. Não precisa de senha.", action: "Acessar meu Passaporte →", company: "Represento uma empresa", companyDetail: "Conheça a nexID e combine o acesso para sua equipe e marca.", companyAction: "Falar com a nexID →" },
};

export default async function WebRegisterPage() {
  const { locale } = await getWebI18n();
  const text = copy[locale];
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(cookieStore.get("theme")?.value, cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value);
  return (
    <main className={styles.register}>
      <div className={styles.registerHeader}><BackLink /><ThemeToggle initialTheme={initialTheme} locale={locale} /></div>
      <section className={styles.registerCard} aria-labelledby="registration-title">
        <h1 id="registration-title">{text.title}</h1>
        <p>{text.intro}</p>
        <div className={styles.choices}>
          <Link className={styles.choice} href="/login?consumer=1&next=%2Fme"><strong>{text.client}</strong><span>{text.detail}</span><b>{text.action}</b></Link>
          <Link className={styles.choice} href="/?contact=demo#contact-modal"><strong>{text.company}</strong><span>{text.companyDetail}</span><b>{text.companyAction}</b></Link>
        </div>
      </section>
    </main>
  );
}
