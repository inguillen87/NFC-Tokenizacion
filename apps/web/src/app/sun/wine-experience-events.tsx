"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  hasPublicExperienceEventScope,
  isSensitivePublicClientExperienceEvent,
  normalizePublicClientExperienceEventType,
  recordPublicExperienceEvent,
  type PublicClientExperienceEventType,
} from "./public-experience-events";

type WineExperienceEventsProps = {
  bid: string;
  eventId: string;
  freshToken: string;
  enabled: boolean;
  allowSensitiveEvents: boolean;
  locale: string;
  sourceCarrier: string;
};

function eventData(element: HTMLElement) {
  const anchor = element.closest<HTMLAnchorElement>("a[href]");
  let destinationHost = "";
  if (anchor?.href) {
    try {
      destinationHost = new URL(anchor.href, window.location.origin).hostname;
    } catch {
      destinationHost = "";
    }
  }
  return {
    ctaLabel: String(element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
    destinationHost,
  };
}

export function WineExperienceEvents({
  bid,
  eventId,
  freshToken,
  enabled,
  allowSensitiveEvents,
  locale,
  sourceCarrier,
}: WineExperienceEventsProps) {
  const pending = useRef(new Set<string>());
  const completed = useRef(new Set<string>());

  const record = useCallback(async (input: {
    eventType: PublicClientExperienceEventType;
    placement: string;
    interactionId: string;
    ctaLabel?: string;
    destinationHost?: string;
  }) => {
    if (!enabled || !hasPublicExperienceEventScope({ bid, eventId })) return;
    if (isSensitivePublicClientExperienceEvent(input.eventType) && !allowSensitiveEvents) return;
    const localKey = `${eventId}:${input.eventType}:${input.placement}:${input.interactionId}:${locale}`;
    if (pending.current.has(localKey) || completed.current.has(localKey)) return;
    pending.current.add(localKey);
    const saved = await recordPublicExperienceEvent({
      bid,
      eventId,
      freshToken,
      eventType: input.eventType,
      placement: input.placement,
      interactionId: `${input.interactionId}:${locale}`,
      keepalive: true,
      sensitiveActionAllowed: allowSensitiveEvents,
      data: {
        surface: "wine_dpp",
        locale,
        sourceCarrier,
        profileVersion: "wine-post-tap-v1",
        ctaLabel: input.ctaLabel || "",
        destinationHost: input.destinationHost || "",
      },
    });
    pending.current.delete(localKey);
    if (saved.ok) completed.current.add(localKey);
  }, [allowSensitiveEvents, bid, enabled, eventId, freshToken, locale, sourceCarrier]);

  useEffect(() => {
    if (!enabled) return;
    const recordPassportView = () => {
      void record({
        eventType: "PRODUCT_VIEWED",
        placement: "passport",
        interactionId: "initial_render",
      });
    };
    recordPassportView();
    window.addEventListener("online", recordPassportView);
    return () => window.removeEventListener("online", recordPassportView);
  }, [enabled, record]);

  useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-sun-experience-event]")
        : null;
      if (!target) return;
      const eventType = normalizePublicClientExperienceEventType(target.dataset.sunExperienceEvent);
      if (!eventType) return;
      const interaction = target.dataset.sunExperienceInteraction || "click";
      const placement = target.dataset.sunExperiencePlacement || "wine_passport";
      void record({ eventType, placement, interactionId: interaction, ...eventData(target) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, record]);

  useEffect(() => {
    if (!enabled) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-sun-experience-impression]"));
    const recordImpression = (node: HTMLElement) => {
      const eventType = normalizePublicClientExperienceEventType(node.dataset.sunExperienceImpression);
      if (!eventType) return;
      void record({
        eventType,
        placement: node.dataset.sunExperiencePlacement || "wine_passport",
        interactionId: node.dataset.sunExperienceInteraction || "visible",
        ...eventData(node),
      });
    };
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(recordImpression);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
        const node = entry.target as HTMLElement;
        observer.unobserve(node);
        recordImpression(node);
      });
    }, { threshold: 0.6 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [enabled, record]);

  return null;
}
