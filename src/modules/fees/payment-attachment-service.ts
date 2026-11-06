import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, stat, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, resolve, join } from "node:path";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId,
  currentUserId,
  FeeError,
  feeFailure,
  requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";
import { lockCurrentSubmitter } from "./payment-reference-service";
import { requireFinancialReads } from "./financial-account-service";
const uuid = z.string().uuid();
const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const MAX_INPUT = 5 * 1024 * 1024,
  MAX_OUTPUT = 10 * 1024 * 1024;
async function storage() {
  const root = process.env.PHASE9_EVIDENCE_STORAGE_DIR;
  if (!root || !isAbsolute(root)) throw new FeeError("NOT_FOUND");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const canonical = await realpath(root);
  const metadata = await stat(canonical);
  if (
    !metadata.isDirectory() ||
    (metadata.mode & 0o077) !== 0 ||
    (process.getuid && metadata.uid !== process.getuid())
  )
    throw new FeeError("INTERNAL");
  for (const unsafe of [resolve("public"), resolve(".next"), resolve(".git")])
    if (canonical === unsafe || canonical.startsWith(unsafe + "/"))
      throw new FeeError("INTERNAL");
  return canonical;
}
/** Raster-only evidence inspection. No SVG, HTML, PDF, encrypted file, URL,
 * arbitrary filename, metadata retention or public asset path is supported. */
export async function normalizePaymentImage(file: File) {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size === 0 ||
    file.size > MAX_INPUT
  )
    throw new FeeError("INVALID_INPUT");
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, {
      limitInputPixels: 4096 * 4096,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      !["png", "jpeg"].includes(meta.format ?? "") ||
      meta.format !== (file.type === "image/png" ? "png" : "jpeg") ||
      !meta.width ||
      !meta.height ||
      meta.width > 4096 ||
      meta.height > 4096 ||
      (meta.pages ?? 1) > 1
    )
      throw new FeeError("INVALID_INPUT");
    const result = await image
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length > MAX_OUTPUT) throw new FeeError("INVALID_INPUT");
    return {
      bytes: result.data,
      sha256: createHash("sha256").update(result.data).digest("hex"),
      width: result.info.width,
      height: result.info.height,
    };
  } catch (e) {
    if (e instanceof FeeError) throw e;
    throw new FeeError("INVALID_INPUT");
  }
}
export async function attachPaymentImage(
  schoolId: string,
  evidenceId: string,
  requestKey: string,
  file: File,
) {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_EVIDENCE_UPLOAD_ENABLED !== "true")
    throw new FeeError("NOT_FOUND");
  checkSchoolId(schoolId);
  if (
    !identifier.safeParse(evidenceId).success ||
    !uuid.safeParse(requestKey).success
  )
    throw new FeeError("INVALID_INPUT");
  const userId = await currentUserId();
  const source = await prisma.paymentEvidence.findFirst({
    where: {
      schoolId,
      id: evidenceId,
      submitter: { userId, role: "SCHOOL_ADMIN", isActive: true },
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!source) throw new FeeError("NOT_FOUND");
  const normalized = await normalizePaymentImage(file),
    root = await storage();
  let written: string | undefined;
  try {
    return await prisma.$transaction(
      async (tx) => {
        const actorMembershipId = await lockCurrentSubmitter(
          tx,
          schoolId,
          userId,
        );
        const replay = await tx.paymentEvidenceAttachment.findFirst({
          where: { schoolId, requestKey },
          select: {
            id: true,
            evidenceId: true,
            sha256: true,
            actorMembershipId: true,
            mediaType: true,
            sizeBytes: true,
            createdAt: true,
          },
        });
        if (replay) {
          if (
            replay.evidenceId !== evidenceId ||
            replay.sha256 !== normalized.sha256 ||
            replay.actorMembershipId !== actorMembershipId
          )
            throw new FeeError("CONFLICT");
          return {
            id: replay.id,
            evidenceId,
            mediaType: replay.mediaType,
            sizeBytes: replay.sizeBytes,
            createdAt: replay.createdAt,
            replay: true,
          };
        }
        const reviewed = await tx.paymentVerificationDecision.findFirst({
          where: { schoolId, evidenceId },
          select: { id: true },
        });
        if (reviewed) throw new FeeError("NOT_FOUND");
        const id = randomUUID(),
          path = join(root, id + ".png");
        const output = await open(path, "wx", 0o600);
        try {
          await output.writeFile(normalized.bytes);
        } finally {
          await output.close();
        }
        written = id;
        const attachment = await tx.paymentEvidenceAttachment.create({
          data: {
            id,
            schoolId,
            evidenceId,
            requestKey,
            sha256: normalized.sha256,
            mediaType: "image/png",
            sizeBytes: normalized.bytes.length,
            width: normalized.width,
            height: normalized.height,
            actorMembershipId,
            actorUserId: userId,
          },
          select: {
            id: true,
            evidenceId: true,
            mediaType: true,
            sizeBytes: true,
            createdAt: true,
          },
        });
        return { ...attachment, replay: false };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    // An unknown commit outcome must not delete evidence that actually committed.
    if (written) {
      const committed = await prisma.paymentEvidenceAttachment
        .findUnique({ where: { id: written }, select: { id: true } })
        .catch(() => undefined);
      if (committed === null)
        await unlink(join(root, written + ".png")).catch(() => {});
    }
    feeFailure(e);
  }
}
async function authorizedAttachment(
  schoolId: string,
  attachmentId: string,
  userId: string,
) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; sha256: string; sizeBytes: number }>
  >(Prisma.sql`SELECT a."id",a."sha256",a."sizeBytes" FROM "PaymentEvidenceAttachment" a
 JOIN "School" s ON s."id"=a."schoolId" AND s."isActive"
 JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."isActive"
 WHERE a."schoolId"=${schoolId} AND a."id"=${attachmentId} AND (m."role"='SCHOOL_SUPER_ADMIN' OR (m."role"='SCHOOL_ADMIN' AND a."actorMembershipId"=m."id"))`);
  if (rows.length !== 1) throw new FeeError("NOT_FOUND");
  return rows[0];
}
export async function readPaymentImage(schoolId: string, attachmentId: string) {
  requireFinancialReads();
  checkSchoolId(schoolId);
  if (!uuid.safeParse(attachmentId).success)
    throw new FeeError("INVALID_INPUT");
  const userId = await currentUserId();
  const row = await authorizedAttachment(schoolId, attachmentId, userId),
    root = await storage();
  const file = await open(
    join(root, attachmentId + ".png"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  let bytes: Buffer;
  try {
    const meta = await file.stat();
    if (!meta.isFile() || meta.size !== row.sizeBytes || meta.size > MAX_OUTPUT)
      throw new FeeError("INTERNAL");
    bytes = await file.readFile();
  } finally {
    await file.close();
  }
  if (
    bytes.length !== row.sizeBytes ||
    createHash("sha256").update(bytes).digest("hex") !== row.sha256
  )
    throw new FeeError("INTERNAL");
  await authorizedAttachment(schoolId, attachmentId, userId);
  return new Uint8Array(bytes);
}
