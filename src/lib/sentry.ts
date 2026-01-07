import * as Sentry from "sentry-expo";
import { getSentryDsn } from "../config/env";

export function initSentry() {
  const dsn = getSentryDsn();
  if (!dsn || dsn === "YOUR_SENTRY_DSN") return;

  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    debug: false,
  });
}


