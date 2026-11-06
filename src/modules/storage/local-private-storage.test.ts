import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLocalPrivateStorage,
  PrivateFileError,
} from "./local-private-storage";

let root: string;

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

async function storage() {
  root = await mkdtemp(join(tmpdir(), "myschoolboard-storage-"));
  return createLocalPrivateStorage(root);
}

describe("local private storage", () => {
  it("requires authorization before upload and download", async () => {
    const files = await storage();
    await expect(
      files.upload({
        tenantId: "school-a",
        contentType: "application/pdf",
        content: Buffer.from("pdf"),
        authorize: async () => false,
      }),
    ).rejects.toThrow(PrivateFileError);
    await expect(
      files.download({
        tenantId: "school-a",
        key: "school-a/00000000-0000-0000-0000-000000000000",
        authorize: async () => false,
      }),
    ).rejects.toThrow("Access denied");
  });

  it("round-trips an authorized private file under its tenant", async () => {
    const files = await storage();
    const uploaded = await files.upload({
      tenantId: "school-a",
      contentType: "application/pdf",
      content: Buffer.from("synthetic document"),
      authorize: async (tenantId) => tenantId === "school-a",
    });
    const downloaded = await files.download({
      tenantId: "school-a",
      key: uploaded.key,
      authorize: async (tenantId) => tenantId === "school-a",
    });
    expect(downloaded.toString()).toBe("synthetic document");
    await expect(
      files.download({
        tenantId: "school-b",
        key: uploaded.key,
        authorize: async () => true,
      }),
    ).rejects.toThrow("Access denied");
  });

  it("rejects traversal keys and disallowed content", async () => {
    const files = await storage();
    await expect(
      files.download({
        tenantId: "school-a",
        key: "../secret",
        authorize: async () => true,
      }),
    ).rejects.toThrow(PrivateFileError);
    await expect(
      files.upload({
        tenantId: "school-a",
        contentType: "text/html",
        content: Buffer.from("<script>"),
        authorize: async () => true,
      }),
    ).rejects.toThrow("File type not allowed");
  });

  it("rejects malformed tenant identifiers before file access", async () => {
    const files = await storage();
    await expect(
      files.download({
        tenantId: "school-a/../../bypass",
        key: "school-a/../../bypass/00000000-0000-0000-0000-000000000000",
        authorize: async () => true,
      }),
    ).rejects.toThrow(PrivateFileError);
  });

  it("rejects oversized files", async () => {
    const files = await storage();
    await expect(
      files.upload({
        tenantId: "school-a",
        contentType: "image/png",
        content: new Uint8Array(5 * 1024 * 1024 + 1),
        authorize: async () => true,
      }),
    ).rejects.toThrow("File size not allowed");
  });
});
