import winston from "winston";
import config from "../config/env";

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
  }`;
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(timestamp(), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), logFormat),
    }),
  ],
});

logger.exceptions.handle(
  new winston.transports.Console({
    format: combine(colorize(), timestamp(), logFormat),
  })
);

export default logger;
