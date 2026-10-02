import styles from './sun-loading.module.css';
import { SunBrandIdentity } from './sun-brand-identity';
const copy={
 'es-AR':['Abriendo el pasaporte','Estamos recuperando la información de esta lectura.','La autenticidad se mostrará sólo cuando responda la validación.','La ubicación es opcional. Podrás compartirla cuando aparezca el pasaporte.'],
 en:['Opening the passport','Retrieving the information for this reading.','Authenticity will be shown only after validation responds.','Location is optional. You can share it when the passport appears.'],
 'pt-BR':['Abrindo o passaporte','Recuperando as informações desta leitura.','A autenticidade será mostrada somente após a resposta da validação.','A localização é opcional. Você poderá compartilhá-la quando o passaporte aparecer.']
};
export function SunLoadingView({locale='es-AR'}:{locale?:string}){
 const text=copy[locale as keyof typeof copy]||copy['es-AR'];
 return <main className={styles.root} data-testid="sun-loading" aria-busy="true"><div className={styles.card}>
 <div className={styles.brand}><SunBrandIdentity/><span className={styles.caption}>{locale==='en'?'Product passport':locale==='pt-BR'?'Passaporte digital':'Pasaporte digital'}</span></div>
 <div className={styles.preview} aria-hidden="true"><div className={styles.tag}>N</div><div><i/><i/><i/></div></div>
 <h1>{text[0]}</h1><p role="status">{text[1]}</p><div className={styles.progress} aria-hidden="true"><span/></div>
 <p className={styles.note}>{text[2]}</p><p className={styles.location}>{text[3]}</p></div></main>;
}
