export const runtime='nodejs';
export const dynamic='force-dynamic';
import {makeRuntimeReadinessHandler} from '../../../../lib/runtime-readiness-http';
export const GET=makeRuntimeReadinessHandler();
