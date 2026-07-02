# Competitive Research: NFC & Authentication Platforms

## 1. Authena
*   **UX/UI (Colors, Typography, Shapes):** Focuses on an intuitive dashboard for brands and supply-chain tracking. While they don't publish a strict design system, they rely on corporate, trust-building aesthetics (solid shapes, standard sans-serif fonts, and tech-focused colors like blues/whites).
*   **Authentication Display:** Designed for a "no-app required" experience via NFC tap. The consumer-facing UI focuses on quick confirmation, utilizing standard status indicators.
*   **Demo/Scanner:** They primarily use video demonstrations and require scheduling a direct sales meeting for a tailored demo. There is no open interactive public web app demo.

## 2. QlikTag
*   **UX/UI (Colors, Typography, Shapes):** Provides a "Visual Interaction Designer" (drag-and-drop tool) so brands can fully customize the UI. Colors, typography, and shapes adapt to the specific brand's guidelines. The core philosophy is mobile-first, high legibility.
*   **Authentication Display:** Employs dynamic NFC keys. Upon tapping, the interface provides immediate, unambiguous feedback—typically large, clear typography showing an "Authenticated" (green) or "Failed" (red) status.
*   **Demo/Scanner:** Primarily showcased through YouTube video walkthroughs (showing their NFC Encoder and Digital Product Passport) or via scheduled live demos.

## 3. Certilogo (Fashion & Luxury Focus)
*   **UX/UI (Colors, Typography, Shapes):** Very clean and functional, avoiding unnecessary decorative elements (like glassmorphism) to prioritize the primary action: authentication. Uses highly legible sans-serif typography and trust-based color psychology (blues, crisp white/gray backgrounds).
*   **Authentication Display:** Utilizes a step-by-step verification wizard asking contextual questions. Status is conveyed clearly using green (for "Authentic") and red/orange (for flags). They also use a recognized "Seal of Authentication" badge.
*   **Demo/Scanner:** Highly interactive. Users can go to their website to manually enter a 12-digit CLG code or scan a QR code. The interface is also frequently embedded directly into partner brands' websites (e.g., Stone Island).

## B2B SaaS Enterprise Authentication UX Best Practices
1.  **Tenant-Aware Context & Intelligent Routing:** Enterprise authentication must be tenant-aware. Use email domain matching (Intelligent Identity Discovery) to automatically route users to their specific organization's SSO flow (SAML/OIDC).
2.  **Professional, Frictionless UI:** Balance seamless access with robust security. The UI should align with enterprise branding—avoid overly playful animations; instead, favor crisp transitions, clear typography, and professional layouts that inspire trust.
3.  **Clear Status & Error Messaging:** B2B users need actionable error states. If an SSO login fails or there is an RBAC (Role-Based Access Control) mismatch, the UI must explain the issue clearly to the user or IT admin rather than showing a generic failure.
4.  **Integrated Security Cues:** Elements like MFA prompts and "Seal of Authenticity" checks should feel native to the workflow, reassuring the user without causing unnecessary friction.
