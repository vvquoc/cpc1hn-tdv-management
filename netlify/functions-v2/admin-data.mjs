import legacy from "../functions/admin-data.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
