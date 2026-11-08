import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, stat, open } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, resolve, join } from "node:path";
import sharp from "sharp";
import { NoticeError } from "@/src/modules/communications/service";
export const sha256 = (b: Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
export async function normalizeLearningRaster(input: Buffer, mime: string) {
  if (
    !["image/png", "image/jpeg"].includes(mime) ||
    !input.length ||
    input.length > 5 * 1024 * 1024
  )
    throw new NoticeError("INVALID_INPUT");
  if (
    mime === "image/png" &&
    (!input
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      !input.subarray(-8, -4).equals(Buffer.from("IEND")))
  )
    throw new NoticeError("INVALID_INPUT");
  if (
    mime === "image/jpeg" &&
    (input[0] !== 255 ||
      input[1] !== 216 ||
      input.at(-2) !== 255 ||
      input.at(-1) !== 217)
  )
    throw new NoticeError("INVALID_INPUT");
  if (mime === "image/png") {
    let offset = 8;
    while (offset < input.length) {
      if (offset + 12 > input.length) throw new NoticeError("INVALID_INPUT");
      const length = input.readUInt32BE(offset);
      if (length > input.length - offset - 12)
        throw new NoticeError("INVALID_INPUT");
      const type = input.toString("ascii", offset + 4, offset + 8);
      if (["acTL", "fcTL", "fdAT"].includes(type))
        throw new NoticeError("INVALID_INPUT");
      offset += length + 12;
    }
  } else if (input.includes(Buffer.from("MPF\0")))
    throw new NoticeError("INVALID_INPUT");
  try {
    const image = sharp(input, {
      limitInputPixels: 4096 * 4096,
      failOn: "warning",
    });
    const m = await image.metadata();
    if (
      m.format !== (mime === "image/png" ? "png" : "jpeg") ||
      !m.width ||
      !m.height ||
      m.width > 4096 ||
      m.height > 4096 ||
      (m.pages ?? 1) !== 1
    )
      throw Error();
    const result = await image
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length > 10 * 1024 * 1024) throw Error();
    return {
      data: result.data,
      sha256: sha256(result.data),
      bytes: result.data.length,
      width: result.info.width,
      height: result.info.height,
    };
  } catch {
    throw new NoticeError("INVALID_INPUT");
  }
}
async function storage() {
  const selected = process.env.PHASE10_LIBRARY_STORAGE_DIR;
  if (!selected || !isAbsolute(selected)) throw new NoticeError("NOT_FOUND");
  await mkdir(selected, { recursive: true, mode: 0o700 });
  const canonical = await realpath(selected),
    info = await stat(canonical);
  if (
    !info.isDirectory() ||
    (info.mode & 0o077) !== 0 ||
    (process.getuid && info.uid !== process.getuid())
  )
    throw new NoticeError("INTERNAL");
  const denied = [resolve("public"), resolve(".next"), resolve(".git")];
  if (process.env.PHASE9_EVIDENCE_STORAGE_DIR) {
    denied.push(resolve(process.env.PHASE9_EVIDENCE_STORAGE_DIR));
    try {
      denied.push(await realpath(process.env.PHASE9_EVIDENCE_STORAGE_DIR));
    } catch {}
  }
  for (const unsafe of denied)
    if (canonical === unsafe || canonical.startsWith(unsafe + "/"))
      throw new NoticeError("INTERNAL");
  return canonical;
}
async function folder(s: string, kind: "quarantine" | "clean") {
  const root = await storage();
  const directory = join(root, sha256(Buffer.from(s)), kind);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const actual = await realpath(directory),
    info = await stat(actual);
  if (
    actual !== directory ||
    (info.mode & 0o077) !== 0 ||
    (process.getuid && info.uid !== process.getuid())
  )
    throw new NoticeError("INTERNAL");
  return directory;
}
const validBlob = (id: string) => {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      id,
    )
  )
    throw new NoticeError("INVALID_INPUT");
};
export interface PrivateLearningBlobStore {
  putQuarantined: (s: string, data: Buffer) => Promise<string>;
  promoteClean: (s: string, data: Buffer) => Promise<string>;
  openQuarantined: (
    s: string,
    blob: string,
    hash: string,
    bytes: number,
  ) => Promise<Buffer>;
  openVersion: (
    s: string,
    blob: string,
    hash: string,
    bytes: number,
  ) => Promise<Buffer>;
}
async function write(s: string, data: Buffer, kind: "quarantine" | "clean") {
  if (
    !data.length ||
    data.length > (kind === "quarantine" ? 5 : 10) * 1024 * 1024
  )
    throw new NoticeError("INVALID_INPUT");
  const directory = await folder(s, kind),
    id = randomUUID(),
    f = await open(
      join(directory, id),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
  try {
    await f.writeFile(data);
    await f.sync();
  } finally {
    await f.close();
  }
  return id;
}
async function read(
  s: string,
  blob: string,
  hash: string,
  bytes: number,
  kind: "quarantine" | "clean",
) {
  validBlob(blob);
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    !Number.isInteger(bytes) ||
    bytes < 1 ||
    bytes > (kind === "quarantine" ? 5 : 10) * 1024 * 1024
  )
    throw new NoticeError("NOT_FOUND");
  const f = await open(
    join(await folder(s, kind), blob),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const metadata = await f.stat();
    if (
      !metadata.isFile() ||
      metadata.nlink !== 1 ||
      metadata.size !== bytes ||
      (metadata.mode & 0o077) !== 0 ||
      (process.getuid && metadata.uid !== process.getuid())
    )
      throw new NoticeError("NOT_FOUND");
    const data = await f.readFile();
    if (data.length !== bytes || sha256(data) !== hash)
      throw new NoticeError("NOT_FOUND");
    return data;
  } finally {
    await f.close();
  }
}
export const privateLearningStore: PrivateLearningBlobStore = {
  putQuarantined: (s, data) => write(s, data, "quarantine"),
  promoteClean: (s, data) => write(s, data, "clean"),
  openQuarantined: (s, b, h, n) => read(s, b, h, n, "quarantine"),
  openVersion: (s, b, h, n) => read(s, b, h, n, "clean"),
};
