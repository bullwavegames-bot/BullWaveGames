import { pino } from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.isProd ? "info" : "debug",
  base: { service: "bullwave-backend", gambling: false },
  redact: ["req.headers.authorization", "password", "passwordHash", "token", "refreshToken"],
});
