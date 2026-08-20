import legacy from "../functions/logout.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
