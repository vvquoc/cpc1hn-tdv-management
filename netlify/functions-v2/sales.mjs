import legacy from "../functions/sales.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
