import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/prescriptions.js");

export default adapt(legacy.default.handler);
