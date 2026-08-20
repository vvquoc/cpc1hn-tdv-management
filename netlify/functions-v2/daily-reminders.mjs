import { adapt } from "./shared/adapter.mjs";
const legacy = await import("../functions/daily-reminders.js");

export default adapt(legacy.default.handler);
