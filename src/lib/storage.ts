import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { RuleError } from "./errors";

// Private file storage for payment screenshots and ID photos.
//   - S3_BUCKET set → AWS S3 (private bucket, server-side encrypted). Credentials come from the standard AWS env vars.
//   - otherwise     → local disk under STORAGE_DIR (development, or a VPS without S3 yet).
// Files are never public: they are served only through /api/files after a role check.

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");
const BUCKET = process.env.S3_BUCKET || "";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

let s3: S3Client | null = null;
const client = () => (s3 ??= new S3Client({ region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1" }));

export const storageBackend = () => (BUCKET ? `s3://${BUCKET}` : `disk:${ROOT}`);

export type Folder = "screenshots" | "ids";
const KEY_PATTERN = /^(screenshots|ids)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(png|jpg|webp)$/;
const contentTypeOf = (ext: string) => (ext === "jpg" ? "image/jpeg" : `image/${ext}`);

/** Detects the real image type from the file's first bytes; the browser's claimed type is not trusted. */
function sniffImage(bytes: Uint8Array): "png" | "jpg" | "webp" | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Validates and stores an uploaded image. Returns the storage key to save in the database. */
export async function putImage(folder: Folder, file: File | null, label = "Screenshot"): Promise<string> {
  if (!file || file.size === 0) throw new RuleError(`Attach the ${label.toLowerCase()}. It's required.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new RuleError(`${label} is too big. The limit is 10 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) throw new RuleError(`${label} must be a PNG, JPG or WebP image.`);
  return putBytes(folder, bytes, ext);
}

export async function putBytes(folder: Folder, bytes: Uint8Array, ext: "png" | "jpg" | "webp"): Promise<string> {
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
  if (BUCKET) {
    await client().send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentTypeOf(ext), ServerSideEncryption: "AES256" }),
    );
    return key;
  }
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
  return key;
}

/** Reads a stored file. Returns null for malformed keys, so a key can never escape the storage folder. */
export async function getFile(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!KEY_PATTERN.test(key)) return null;
  const contentType = contentTypeOf(key.split(".").pop()!);
  try {
    if (BUCKET) {
      const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      return res.Body ? { bytes: await res.Body.transformToByteArray(), contentType } : null;
    }
    return { bytes: new Uint8Array(await readFile(path.join(ROOT, key))), contentType };
  } catch (e) {
    if (e instanceof NoSuchKey || (e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export const fileUrl = (key: string) => `/api/files/${key}`;
