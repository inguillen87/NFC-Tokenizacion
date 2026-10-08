import { getWebI18n } from '../../lib/locale';
import { SunLoadingView } from '../sun/sun-loading-view';

export default async function ConsumerAccountLoading() {
  const { locale } = await getWebI18n();
  return <SunLoadingView locale={locale} mode="account" />;
}
