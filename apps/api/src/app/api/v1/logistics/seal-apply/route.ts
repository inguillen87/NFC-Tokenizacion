import { executeLogisticsScan } from "../_atomic";
export async function POST(req:Request){ return executeLogisticsScan(req,"APPLY","logistics.seal_apply"); }
