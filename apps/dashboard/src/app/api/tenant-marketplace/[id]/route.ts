import { marketplaceMethodUnavailable } from "../route-helpers";
// Catalogue changes use explicit save/publish/withdraw commands. No physical sale or deletion.
export const PATCH = () => marketplaceMethodUnavailable();
export const DELETE = () => marketplaceMethodUnavailable();
