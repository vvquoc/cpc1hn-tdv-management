import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/bootstrap-data.js");

export default adapt(legacy.default.handler);
