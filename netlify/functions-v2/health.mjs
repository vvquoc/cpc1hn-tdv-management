import legacy from "../functions/health.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
