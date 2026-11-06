import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const maxFileBytes = 5 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const tenantPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const keyPattern = /^[a-zA-Z0-9_-]{1,100}\/[0-9a-f-]{36}$/;

export class PrivateFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateFileError";
  }
}

export function createLocalPrivateStorage(rootDirectory: string) {
  const root = resolve(rootDirectory);

  function resolveKey(key: string): string {
    if (!keyPattern.test(key)) throw new PrivateFileError("Invalid file key");
    const path = resolve(root, key);
    if (!path.startsWith(`${root}${sep}`))
      throw new PrivateFileError("Invalid file key");
    return path;
  }

  return {
    async upload(input: {
      tenantId: string;
      contentType: string;
      content: Uint8Array;
      authorize: (tenantId: string) => Promise<boolean>;
    }): Promise<{ key: string }> {
      if (!(await input.authorize(input.tenantId)))
        throw new PrivateFileError("Access denied");
      if (!tenantPattern.test(input.tenantId))
        throw new PrivateFileError("Invalid tenant");
      if (!allowedTypes.has(input.contentType))
        throw new PrivateFileError("File type not allowed");
      if (
        input.content.byteLength === 0 ||
        input.content.byteLength > maxFileBytes
      ) {
        throw new PrivateFileError("File size not allowed");
      }

      const key = `${input.tenantId}/${randomUUID()}`;
      const path = resolveKey(key);
      await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
      await writeFile(path, input.content, { flag: "wx", mode: 0o600 });
      return { key };
    },

    async download(input: {
      tenantId: string;
      key: string;
      authorize: (tenantId: string) => Promise<boolean>;
    }): Promise<Buffer> {
      if (!tenantPattern.test(input.tenantId))
        throw new PrivateFileError("Invalid tenant");
      if (!(await input.authorize(input.tenantId)))
        throw new PrivateFileError("Access denied");
      if (!input.key.startsWith(`${input.tenantId}/`))
        throw new PrivateFileError("Access denied");
      return readFile(resolveKey(input.key));
    },
  };
}
