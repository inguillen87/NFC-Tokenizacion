/** Mirrors the currently deployed global-only notifications endpoint.
 * This is a render/fetch gate, not a replacement for backend authorization. */
export function canReadGlobalNotifications(access: {role?: string; tenantSlug?: string | null; tenantId?: string | null; isDemo?: boolean}): boolean {
  return access.role === 'super-admin' && !access.tenantSlug && !access.tenantId && access.isDemo !== true;
}
export type AdminNotificationSummary = {unreadCount:number; counts:{new_leads:number;open_tickets:number;new_orders:number}};
export function parseAdminNotificationSummary(value: unknown): AdminNotificationSummary {
  const v=value as Record<string,unknown>|null,c=v?.counts as Record<string,unknown>|null;
  if(!v||v.ok!==true||v.demoMode===true||v.demo===true||!c)throw Error('notification_summary_invalid');
  const keys=['new_leads','open_tickets','new_orders'] as const;
  if(!Number.isSafeInteger(v.unreadCount)||Number(v.unreadCount)<0||keys.some(k=>!Number.isSafeInteger(c[k])||Number(c[k])<0))throw Error('notification_summary_invalid');
  const counts={new_leads:Number(c.new_leads),open_tickets:Number(c.open_tickets),new_orders:Number(c.new_orders)};
  const sum=counts.new_leads+counts.open_tickets+counts.new_orders;
  if(!Number.isSafeInteger(sum)||v.unreadCount!==sum)throw Error('notification_summary_invalid');
  return {unreadCount:sum,counts};
}
