"use client";

import { useSunLocale } from "./sun-locale-provider";
import { CurrentEditorialResourcesView } from "./current-editorial-resources-view";
import type { CurrentEditorialResourcesProps } from "./current-editorial-resources-model";

export type { CurrentEditorialResourcesProps } from "./current-editorial-resources-model";

export function CurrentEditorialResources(props: CurrentEditorialResourcesProps) {
  const { locale } = useSunLocale();
  return <CurrentEditorialResourcesView {...props} locale={locale} />;
}
