// Consumer email/phone sessions and public NFC reads use NexID's own API.
// Clerk is needed only for the optional Web3 UI, its verified token bridge,
// and the SDK's reserved support routes. Match complete path segments.
export function requiresClerkMiddleware(pathname: string) {
  return pathname === "/web3"
    || pathname.startsWith("/web3/")
    || pathname === "/api/consumer/auth/web3"
    || pathname === "/__clerk"
    || pathname.startsWith("/__clerk/");
}
