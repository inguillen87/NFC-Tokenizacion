import { getWebI18n } from '../../lib/locale';
import { SunLoadingView } from './sun-loading-view';
export default async function SunLoading(){const {locale}=await getWebI18n();return <SunLoadingView locale={locale}/>;}
