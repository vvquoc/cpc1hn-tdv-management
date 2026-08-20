import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/dashboard.js");

export default adapt(legacy.default.handler);
