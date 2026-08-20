import legacy from "../functions/daily-reminders.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
