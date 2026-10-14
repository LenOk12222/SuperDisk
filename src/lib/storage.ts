/**
 * Абстракция хранилища файлов.
 *
 * STORAGE_DRIVER=s3  — S3-совместимое хранилище (AWS S3, MinIO, SeaweedFS, …),
 *                      бакет приватный, скачивание только через presigned-URL
 *                      после серверной проверки прав.
 * STORAGE_DRIVER=local (по умолчанию) — локальный диск вне публичной директории;
 *                      файл отдаётся только потоком через API с проверкой прав.
 */
import { createReadStream } from "fs";
import { mkdir, readFile, unlink, writeFile, stat } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DRIVER = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();

const LOCAL_ROOT =
  process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".storage");

const S3 = DRIVER === "s3" ? new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
}) : null;

const S3_BUCKET = process.env.S3_BUCKET ?? "";
const PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL ?? 60); // сек

export function storageDriver() {
  return DRIVER;
}

export function newStorageKey(workspaceId: string, safeName: string): string {
  return `workspaces/${workspaceId}/${randomUUID()}--${safeName}`.slice(0, 300);
}

let s3BucketReady: Promise<void> | null = null;

/**
 * Для локального S3 (MinIO) бакет создаётся автоматически при первой загрузке.
 * Для настоящего AWS S3 бакет должен существовать заранее — автосоздание не выполняем.
 */
async function ensureS3Bucket() {
  if (DRIVER !== "s3" || !S3 || !process.env.S3_ENDPOINT) return;
  if (!s3BucketReady) {
    s3BucketReady = (async () => {
      try {
        await S3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        const missing =
          e.$metadata?.httpStatusCode === 404 || e.name === "NotFound" || e.name === "NoSuchBucket";
        if (!missing) throw err;
        try {
          await S3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
        } catch (createErr) {
          const ce = createErr as { name?: string };
          if (ce.name !== "BucketAlreadyOwnedByYou" && ce.name !== "BucketAlreadyExists") {
            throw createErr;
          }
        }
      }
    })().catch((err) => {
      s3BucketReady = null; // не кэшируем временный сбой MinIO
      throw err;
    });
  }
  return s3BucketReady;
}

localEnsure();
async function localEnsure() {
  if (DRIVER === "local") await mkdir(LOCAL_ROOT, { recursive: true });
}

function localPath(key: string): string {
  // key строится нами (uuid), но дополнительная защита от traversal не помешает
  const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(LOCAL_ROOT, normalized);
  if (!full.startsWith(path.normalize(LOCAL_ROOT))) throw new Error("bad key");
  return full;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  if (DRIVER === "s3") {
    await ensureS3Bucket();
    await S3!.send(
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    return;
  }
  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(ab as ArrayBuffer));
}

export async function deleteObject(key: string) {
  if (DRIVER === "s3") {
    await S3!.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return;
  }
  await unlink(localPath(key)).catch(() => {});
}

export async function readObject(key: string): Promise<Buffer> {
  if (DRIVER === "s3") {
    const out = await S3!.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of out.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return readFile(localPath(key));
}

export function streamLocalObject(key: string) {
  return createReadStream(localPath(key));
}

export async function statLocalObject(key: string) {
  return stat(localPath(key));
}

/** Временная ссылка на приватный объект; вызывается ТОЛЬКО после проверки прав */
export async function presignedGetUrl(key: string, fileName: string, mime: string) {
  if (DRIVER !== "s3") return null;
  return getSignedUrl(
    S3!,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ResponseContentType: mime,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: PRESIGN_TTL },
  );
}
