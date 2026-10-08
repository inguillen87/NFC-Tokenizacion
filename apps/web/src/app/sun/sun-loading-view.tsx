import styles from './sun-loading.module.css';
import { SunBrandIdentity } from './sun-brand-identity';
const copy={
 'es-AR':['Abriendo el pasaporte','Estamos recuperando la información de esta lectura.','La autenticidad se mostrará sólo cuando responda la validación.','La ubicación es opcional. Podrás compartirla cuando aparezca el pasaporte.'],
 en:['Opening the passport','Retrieving the information for this reading.','Authenticity will be shown only after validation responds.','Location is optional. You can share it when the passport appears.'],
 'pt-BR':['Abrindo o passaporte','Recuperando as informações desta leitura.','A autenticidade será mostrada somente após a resposta da validação.','A localização é opcional. Você poderá compartilhá-la quando o passaporte aparecer.']
};
const noScriptCopy={
 'es-AR':['Activá JavaScript para continuar','El pasaporte y el acceso a tu cuenta necesitan JavaScript. Activá esta opción en tu navegador para continuar.','Mi cuenta'],
 en:['Enable JavaScript to continue','The passport and account sign-in require JavaScript. Enable it in your browser to continue.','My account'],
 'pt-BR':['Ative o JavaScript para continuar','O passaporte e o acesso à sua conta precisam de JavaScript. Ative essa opção no navegador para continuar.','Minha conta']
};
const accountCopy={
 'es-AR':['Abriendo tu cuenta','Estamos preparando el acceso a tus productos y marcas.','Tu cuenta necesita JavaScript','Activá JavaScript en tu navegador y volvé a abrir esta página para entrar a tu cuenta.'],
 en:['Opening your account','Preparing access to your products and brands.','Your account requires JavaScript','Enable JavaScript in your browser and reopen this page to sign in to your account.'],
 'pt-BR':['Abrindo sua conta','Preparando o acesso aos seus produtos e marcas.','Sua conta precisa de JavaScript','Ative o JavaScript no navegador e abra esta página novamente para entrar na sua conta.']
};
export function SunLoadingView({locale='es-AR',mode='passport'}:{locale?:string;mode?:'passport'|'account'}){
 const isAccount=mode==='account';
 const account=accountCopy[locale as keyof typeof accountCopy]||accountCopy['es-AR'];
 const text=isAccount?account:copy[locale as keyof typeof copy]||copy['es-AR'];
 const fallback=isAccount?[account[2],account[3]]:noScriptCopy[locale as keyof typeof noScriptCopy]||noScriptCopy['es-AR'];
 const loadingId=isAccount?'account-loading':'sun-loading',fallbackId=isAccount?'account-nojs-fallback':'sun-nojs-fallback',titleId=isAccount?'account-nojs-title':'sun-nojs-title';
 return <><main className={styles.root} data-testid={loadingId} aria-busy="true"><div className={styles.card}>
 <div className={styles.brand}><SunBrandIdentity/><span className={styles.caption}>{isAccount?(locale==='en'?'My account':locale==='pt-BR'?'Minha conta':'Mi cuenta'):(locale==='en'?'Product passport':locale==='pt-BR'?'Passaporte digital':'Pasaporte digital')}</span></div>
 {!isAccount&&<div className={styles.preview} aria-hidden="true"><div className={styles.tag}>N</div><div><i/><i/><i/></div></div>}
 <h1>{text[0]}</h1><p role="status">{text[1]}</p><div className={styles.progress} aria-hidden="true"><span/></div>
 {!isAccount&&<><p className={styles.note}>{text[2]}</p><p className={styles.location}>{text[3]}</p></>}</div></main>
 <noscript>
  <style>{'[data-testid='+loadingId+'] { display: none !important; }'}</style>
  <section className={styles.root} data-testid={fallbackId} aria-labelledby={titleId}>
   <div className={styles.card}><div className={styles.brand}><SunBrandIdentity/></div>
    <h1 id={titleId}>{fallback[0]}</h1><p>{fallback[1]}</p>
    {!isAccount&&<a className={styles.accountLink} href="/me" referrerPolicy="no-referrer" data-testid="sun-nojs-account-link">{fallback[2]}</a>}
   </div>
  </section>
 </noscript></>;
}
