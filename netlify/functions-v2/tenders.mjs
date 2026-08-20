import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/tenders.js");

export default adapt(legacy.default.handler);
