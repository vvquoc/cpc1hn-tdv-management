import legacy from "../functions/login.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
