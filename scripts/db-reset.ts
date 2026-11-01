import "dotenv/config";
import { spawn } from "node:child_process";
import { assertLocalResetTarget } from "../src/lib/database-target";

assertLocalResetTarget();

const command = process.platform === "win32" ? "prisma.cmd" : "prisma";
const reset = spawn(command, ["migrate", "reset", "--force"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

reset.on("error", (error) => {
  console.error(`Could not start Prisma reset: ${error.message}`);
  process.exitCode = 1;
});

reset.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
