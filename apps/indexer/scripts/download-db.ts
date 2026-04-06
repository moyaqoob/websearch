import { ensureDbPresent } from "../shared/ensure-db";

ensureDbPresent().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
