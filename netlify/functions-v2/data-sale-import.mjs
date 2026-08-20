import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/data-sale-import.js");

export default adapt(legacy.default.handler);
