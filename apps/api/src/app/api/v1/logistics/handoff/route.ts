import { executeLogisticsScan } from "../_atomic";
export async function POST(req:Request){ return executeLogisticsScan(req,"HANDOFF","logistics.handoff"); }
