import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/login.js");

export default adapt(legacy.default.handler);
