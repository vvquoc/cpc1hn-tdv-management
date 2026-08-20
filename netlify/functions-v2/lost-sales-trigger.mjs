import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/lost-sales-trigger.js");

export default adapt(legacy.default.handler);
