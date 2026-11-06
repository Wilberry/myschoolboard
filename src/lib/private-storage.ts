import { resolve } from "node:path";
import { env } from "@/src/lib/env";
import { createLocalPrivateStorage } from "@/src/modules/storage/local-private-storage";

export const privateStorage = createLocalPrivateStorage(
  resolve(process.cwd(), env.PRIVATE_STORAGE_ROOT),
);
