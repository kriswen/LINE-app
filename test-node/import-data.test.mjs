import assert from "node:assert/strict";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../scripts/import-data.js", import.meta.url);

async function fixtureDirectory(overrides = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "line-import-"));
  await writeFile(path.join(dir, "subs.json"), JSON.stringify(["group'o"]));
  await writeFile(
    path.join(dir, "message.json"),
    JSON.stringify({
      reminders: [
        {
          time: "09:00",
          daysOfWeek: [1],
          message: "Dad's medicine",
          includeMedicineReminder: true,
        },
      ],
    })
  );
  await writeFile(
    path.join(dir, "bp-logs.json"),
    JSON.stringify(
      overrides.bpLogs ?? [{ id: "bp'1", date: "2026-09-01", sys: 120, dia: 80 }]
    )
  );
  await writeFile(path.join(dir, "oneoff-reminders.json"), "[]");
  return dir;
}

test("data importer runs without undeclared packages and emits SQL only", async () => {
  const cwd = await fixtureDirectory();
  const result = spawnSync(process.execPath, [script.pathname], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Generating migration SQL|To apply this migration/);
  assert.match(result.stdout, /group''o/);
  assert.match(result.stdout, /Dad''s medicine/);
  assert.match(result.stdout, /bp''1/);
});

test("data importer rejects non-numeric values instead of emitting executable SQL", async () => {
  const cwd = await fixtureDirectory({
    bpLogs: [
      {
        id: "bp-unsafe",
        date: "2026-09-01",
        sys: "120); DROP TABLE subscribers; --",
        dia: 80,
      },
    ],
  });
  const result = spawnSync(process.execPath, [script.pathname], {
    cwd,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Invalid systolic/);
});

test("missing optional files never corrupt SQL stdout", async () => {
  const cwd = await fixtureDirectory();
  await unlink(path.join(cwd, "oneoff-reminders.json"));
  const result = spawnSync(process.execPath, [script.pathname], {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /File not found/);
  assert.match(result.stderr, /File not found:.*oneoff-reminders\.json/);
});

test("malformed existing JSON fails the import", async () => {
  const cwd = await fixtureDirectory();
  await writeFile(path.join(cwd, "message.json"), "{not-json");
  const result = spawnSync(process.execPath, [script.pathname], {
    cwd,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Error reading message\.json/);
});
