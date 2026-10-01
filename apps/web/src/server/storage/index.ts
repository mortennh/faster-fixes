import "server-only";

import { cloudflare, minio } from "@better-upload/server/clients";

// `?? ""` rather than `requireEnv`: this client is built at import, and throwing
// there would break `next build` and test imports that run without R2 env.
// Self-hosting: MINIO_ENDPOINT (public URL, presigned links point there) switches
// to any S3-compatible store such as MinIO.
export const s3Client = process.env.MINIO_ENDPOINT
  ? minio({
      endpoint: process.env.MINIO_ENDPOINT,
      region: process.env.STORAGE_REGION || "us-east-1",
      accessKeyId: process.env.MINIO_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY ?? "",
    })
  : cloudflare({
      accountId: process.env.R2_ACCOUNT_ID ?? "",
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    });
