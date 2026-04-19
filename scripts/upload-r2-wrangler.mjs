import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const bucket = process.env.R2_BUCKET || "alora-papers";
const papersRoot = path.resolve(
  process.env.PAPERS_ROOT || "/Users/paramveer/Desktop/Alora_PastPaperApi"
);
const publicBaseUrl =
  process.env.PUBLIC_PAPERS_BASE_URL ||
  "https://pub-3566d2e7d08b466a85022bfffc6e5950.r2.dev";
const concurrency = Math.max(1, Number(process.env.UPLOAD_CONCURRENCY || 3));
const maxAttempts = Math.max(1, Number(process.env.UPLOAD_ATTEMPTS || 4));
const statePath = path.resolve(process.env.UPLOAD_STATE || ".r2-upload-remote-state.json");

const paperRoots = ["GCSE", "A-Level"];

if (!fs.existsSync(papersRoot)) {
  throw new Error(`PAPERS_ROOT does not exist: ${papersRoot}`);
}

for (const folder of paperRoots) {
  const absoluteFolder = path.join(papersRoot, folder);

  if (!fs.existsSync(absoluteFolder)) {
    throw new Error(`Missing paper folder: ${absoluteFolder}`);
  }
}

await runCommand("node", ["scripts/generate-public-catalog.mjs"], {
  PAPERS_ROOT: papersRoot,
  PUBLIC_PAPERS_BASE_URL: publicBaseUrl,
});

const pdfFiles = paperRoots.flatMap((folder) =>
  findFiles(path.join(papersRoot, folder), ".pdf").map((absolutePath) => ({
    absolutePath,
    key: toPosix(path.relative(papersRoot, absolutePath)),
    contentType: "application/pdf",
    cacheControl: "public, max-age=31536000, immutable",
  }))
);
const uploadItems = [
  ...pdfFiles,
  {
    absolutePath: path.resolve("dist/catalog.json"),
    key: "catalog.json",
    contentType: "application/json; charset=utf-8",
    cacheControl: "public, max-age=300",
  },
];
const state = readState(statePath);
const remaining = uploadItems.filter((item) => !state.uploaded[item.key]);

console.log(`Bucket: ${bucket}`);
console.log(`Public base URL: ${publicBaseUrl}`);
console.log(`Paper root: ${papersRoot}`);
console.log(`Total objects: ${uploadItems.length}`);
console.log(`Already uploaded: ${uploadItems.length - remaining.length}`);
console.log(`Remaining: ${remaining.length}`);
console.log(`Concurrency: ${concurrency}`);
console.log(`Attempts per object: ${maxAttempts}`);

let completed = uploadItems.length - remaining.length;
let failed = 0;
let cursor = 0;

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < remaining.length) {
      const item = remaining[cursor++];

      try {
        await uploadObjectWithRetry(item);
        state.uploaded[item.key] = {
          sizeBytes: fs.statSync(item.absolutePath).size,
          uploadedAt: new Date().toISOString(),
        };
        completed += 1;

        if (completed % 25 === 0 || completed === uploadItems.length) {
          writeState(statePath, state);
          console.log(`${completed}/${uploadItems.length} uploaded`);
        }
      } catch (error) {
        failed += 1;
        writeState(statePath, state);
        console.error(`Failed: ${item.key}`);
        console.error(error instanceof Error ? error.message : error);
      }
    }
  })
);

writeState(statePath, state);

if (failed > 0) {
  console.error(`Finished with ${failed} failed upload(s). Re-run the command to resume.`);
  process.exit(1);
}

console.log(`Done. Test ${publicBaseUrl}/catalog.json`);

function uploadObject(item) {
  return runCommand("npx", [
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/${item.key}`,
    "--file",
    item.absolutePath,
    "--content-type",
    item.contentType,
    "--cache-control",
    item.cacheControl,
    "--remote",
    "--force",
  ]);
}

async function uploadObjectWithRetry(item) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await uploadObject(item);
      return;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const delayMs = 1000 * attempt * attempt;
      console.warn(`Retrying ${item.key} after attempt ${attempt}/${maxAttempts}`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function runCommand(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.trim()) {
        process.stdout.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${stderr}`));
    });
  });
}

function findFiles(root, extension) {
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function readState(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      uploaded: {},
    };
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeState(filePath, state) {
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
