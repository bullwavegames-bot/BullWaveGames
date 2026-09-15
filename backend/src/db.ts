import postgres from "postgres";
import { config } from "./config.js";

export const sql = postgres(config.databaseUrl, {
  max: config.serviceKind === "worker" ? 3 : 10,
  idle_timeout: 20,
  connect_timeout: 15,
  onnotice: () => undefined,
});
