import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/health.js");

export default adapt(legacy.default.handler);
