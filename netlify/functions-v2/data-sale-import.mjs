import legacy from "../functions/data-sale-import.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
