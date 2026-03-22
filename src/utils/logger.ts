// structured logger using winston
// dev = pretty colored output, production = json (so you can ship logs to any log aggregator)

import winston from "winston";
import { env } from "../config/env.js";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// human-readable format for dev
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}] ${message}${metaStr}${stack ? `\n${stack}` : ""}`;
  })
);

// json format for production - works with datadog, logtail, etc
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  // never crash the server on a logging error
  exitOnError: false,
});
