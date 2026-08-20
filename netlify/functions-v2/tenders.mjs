import legacy from "../functions/tenders.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
