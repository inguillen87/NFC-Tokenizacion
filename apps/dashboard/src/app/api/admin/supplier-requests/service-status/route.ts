import { forwardSupplierRequest } from '../../../../../lib/supplier-request-proxy';
export async function GET(req: Request) { return forwardSupplierRequest(req, ['service-status']); }
