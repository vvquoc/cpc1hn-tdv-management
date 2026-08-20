import legacy from "../functions/lost-sales-trigger.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
