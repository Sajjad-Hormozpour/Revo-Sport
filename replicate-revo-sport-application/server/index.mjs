import { rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceCommit = "9b1ca6bca5266820b9cd468d84bb49d745a6652b";
const sourceUrl = `https://raw.githubusercontent.com/Sajjad-Hormozpour/Revo-Sport/${sourceCommit}/pixel-perfect-persian-web-page%20(1)/server/index.mjs`;
const directory = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(directory, ".revo-source-server.mjs");
const pendingFile = `${runtimeFile}.${process.pid}.tmp`;

const response = await fetch(sourceUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`Could not load the pinned Revo Sport API (${response.status})`);

await writeFile(pendingFile, await response.text(), { encoding: "utf8", mode: 0o600 });
await rename(pendingFile, runtimeFile);
await import(pathToFileURL(runtimeFile).href);