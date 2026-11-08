import { it, expect, vi } from "vitest";
import { mkdtemp, symlink, link, chmod } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  normalizeLearningRaster,
  privateLearningStore,
  sha256,
} from "./private-learning-store";
import { readLearningUpload } from "./bounded-upload";
const uploadBase = new URL(process.env.BETTER_AUTH_URL!).origin;
const pixels = () =>
  sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 2, g: 3, b: 4 },
    },
  });
it("normalizes safe raster bytes, strips metadata and rejects active/trailing/mismatched formats", async () => {
  const jpeg = await pixels()
    .withMetadata({ exif: { IFD0: { Artist: "Synthetic private metadata" } } })
    .jpeg()
    .toBuffer();
  const cleaned = await normalizeLearningRaster(jpeg, "image/jpeg");
  expect((await sharp(cleaned.data).metadata()).exif).toBeUndefined();
  expect((await sharp(cleaned.data).metadata()).format).toBe("png");
  const png = await pixels().png().toBuffer();
  for (const [data, mime] of [
    [png, "application/pdf"],
    [png, "image/jpeg"],
    [Buffer.concat([png, Buffer.from("<svg/>")]), "image/png"],
    [Buffer.from("<svg/>"), "image/svg+xml"],
    [
      await sharp({
        create: { width: 4097, height: 1, channels: 3, background: "black" },
      })
        .png()
        .toBuffer(),
      "image/png",
    ],
  ] as const)
    await expect(normalizeLearningRaster(data, mime)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
});
it("uses private tenant paths and rejects wrong hashes, symlinks, hardlinks and public file modes", async () => {
  const root = await mkdtemp("/tmp/phase10-learning-store-");
  vi.stubEnv("PHASE10_LIBRARY_STORAGE_DIR", root);
  const data = await pixels().png().toBuffer(),
    s = "synthetic-store-school";
  try {
    const id = await privateLearningStore.promoteClean(s, data);
    expect(
      await privateLearningStore.openVersion(s, id, sha256(data), data.length),
    ).toEqual(data);
    await expect(
      privateLearningStore.openVersion(s, id, "0".repeat(64), data.length),
    ).rejects.toThrow();
    await expect(
      privateLearningStore.openVersion(
        "foreign-school",
        id,
        sha256(data),
        data.length,
      ),
    ).rejects.toThrow();
    const path = join(root, sha256(Buffer.from(s)), "clean"),
      pointer = randomUUID();
    await symlink(join(path, id), join(path, pointer));
    await expect(
      privateLearningStore.openVersion(s, pointer, sha256(data), data.length),
    ).rejects.toThrow();
    await link(join(path, id), join(path, randomUUID()));
    await expect(
      privateLearningStore.openVersion(s, id, sha256(data), data.length),
    ).rejects.toThrow();
    const another = await privateLearningStore.promoteClean(s, data);
    await chmod(join(path, another), 0o644);
    await expect(
      privateLearningStore.openVersion(s, another, sha256(data), data.length),
    ).rejects.toThrow();
    await expect(
      privateLearningStore.openVersion(
        s,
        "../../secret",
        sha256(data),
        data.length,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  } finally {
    vi.unstubAllEnvs();
  }
});
function request(form: FormData, origin = uploadBase) {
  return new Request(uploadBase + "/api/library", {
    method: "POST",
    headers: { origin },
    body: form,
  });
}
it("accepts bounded same-origin multipart without trusting client filenames", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [new Uint8Array(await pixels().png().toBuffer())],
      "../../ignored.png",
      { type: "image/png" },
    ),
  );
  form.set("expectedRevision", "1");
  form.set("reason", "Synthetic safe upload");
  form.set("requestKey", randomUUID());
  const parsed = await readLearningUpload(request(form));
  expect(parsed.file.size).toBeGreaterThan(0);
  expect(parsed.expectedRevision).toBe("1");
});
it("compares uploads with the configured public origin behind an internal bind address", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [new Uint8Array(await pixels().png().toBuffer())],
      "synthetic.png",
      { type: "image/png" },
    ),
  );
  form.set("expectedRevision", "1");
  form.set("reason", "Synthetic reverse-proxy origin verification");
  form.set("requestKey", randomUUID());
  expect(
    (
      await readLearningUpload(
        new Request("http://0.0.0.0:3001/api/library", {
          method: "POST",
          headers: { origin: uploadBase },
          body: form,
        }),
      )
    ).file.size,
  ).toBeGreaterThan(0);
});
it("rejects absent/foreign origin, duplicate fields and actual streamed-byte overflows", async () => {
  const form = new FormData();
  form.set("file", new File(["synthetic"], "a.png", { type: "image/png" }));
  form.set("expectedRevision", "1");
  form.set("reason", "Synthetic safe upload");
  form.set("requestKey", randomUUID());
  await expect(
    readLearningUpload(request(form, "https://foreign.example")),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  form.append("reason", "duplicated");
  await expect(readLearningUpload(request(form))).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(5 * 1024 * 1024 + 65537));
      c.close();
    },
  });
  const oversized = new Request(uploadBase + "/api/library", {
    method: "POST",
    headers: {
      origin: uploadBase,
      "content-type": "multipart/form-data; boundary=synthetic",
      "content-length": "1",
    },
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(readLearningUpload(oversized)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});
