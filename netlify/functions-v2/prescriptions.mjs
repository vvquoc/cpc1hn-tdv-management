import legacy from "../functions/prescriptions.js";
import { adapt } from "./shared/adapter.mjs";

export default adapt(legacy.handler);
