"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requestConsumerJson } from "../../../lib/consumer-request";
import { consumerFeedbackAvailability, CONSUMER_FEEDBACK_UNAVAILABLE, type ConsumerFeedbackAvailability } from "./consumer-feedback-policy";

export function ConsumerFeedbackLink({ eventId, tenant, href, className }: { eventId: string; tenant: string; href: string; className?: string }) {
  const [resolved, setResolved] = useState<{ eventId: string; tenant: string; availability: ConsumerFeedbackAvailability } | null>(null);
  const availability = resolved?.eventId === eventId && resolved.tenant === tenant ? resolved.availability : "checking";
  useEffect(() => {
    let active = true;
    setResolved(null);
    if (!/^[1-9]\d{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) {
      setResolved({ eventId, tenant, availability: "unavailable" });
      return () => { active = false; };
    }
    void requestConsumerJson(`/api/public/passport/${encodeURIComponent(eventId)}/configuration`, {
      method: "GET", cache: "no-store", credentials: "omit", redirect: "error",
    }).then(result => {
      if (!active) return;
      setResolved({ eventId, tenant, availability: consumerFeedbackAvailability(result.status === "received" && result.ok && result.payload?.ok === true ? result.payload.configuration : null, tenant) });
    });
    return () => { active = false; };
  }, [eventId, tenant]);
  return availability === "available"
    ? <Link prefetch={false} className={className} href={href}><MessageSquareText size={17} aria-hidden="true" />Compartir experiencia</Link>
    : <p role="status">{CONSUMER_FEEDBACK_UNAVAILABLE[availability]}</p>;
}
