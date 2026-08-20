import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/sales.js");

export default adapt(legacy.default.handler);
