"use client";

import { ConsumerPortalRecovery } from "./_components/consumer-portal-recovery";

export default function ConsumerPortalError({ reset, retry }: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  return <ConsumerPortalRecovery retry={retry ?? reset} />;
}
