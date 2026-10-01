import "server-only";

import { createMailer } from "./mailer-factory";
import type { Mailer } from "./types";

// Created on first use, not at import: self-hosted instances without a mailer
// key must still load every module that imports `mailer` (auth config, Inngest
// functions). Sending then fails with the factory's "Missing … RESEND_API_KEY".
let instance: Mailer | undefined;

export const mailer: Mailer = new Proxy({} as Mailer, {
  get(_target, property) {
    instance ??= createMailer();
    return Reflect.get(instance, property, instance);
  },
});

export type { Mailer } from "./types";
