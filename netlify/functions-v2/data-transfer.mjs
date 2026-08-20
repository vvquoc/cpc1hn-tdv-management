import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/data-transfer.js");

export default adapt(legacy.default.handler);
