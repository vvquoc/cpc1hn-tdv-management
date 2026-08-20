import legacy from "../functions/data-transfer.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
