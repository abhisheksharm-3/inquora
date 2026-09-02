/**
 * Runs the pgTAP suite in `supabase/tests` against the database named by
 * SUPABASE_DB_URL, and exits non-zero if any assertion fails.
 *
 * `supabase test db` does the same thing by pulling a pg_prove container. This
 * needs no Docker, which is what lets the SQL suite run in CI next to the
 * TypeScript one. Each file already wraps itself in begin/rollback, so a run
 * leaves nothing behind.
 */
import { readdirSync, readFileSync } from "node:fs";
import { SQL } from "bun";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Expected a Postgres connection string.");
  process.exit(2);
}

const dir = "supabase/tests";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();

const sql = new SQL(url, { max: 1 });
let assertions = 0;
let failures = 0;

for (const file of files) {
  const body = readFileSync(`${dir}/${file}`, "utf8");
  let lines: string[] = [];

  try {
    // pgTAP's functions live in the extensions schema, and the test files call
    // them unqualified the way pg_prove does.
    const sets = await sql.unsafe(`set search_path = public, extensions;\n${body}`).simple();
    lines = (sets as unknown[])
      .flat()
      .flatMap((row) => Object.values(row as Record<string, unknown>))
      .filter((v): v is string => typeof v === "string")
      .flatMap((v) => v.split("\n"));
  } catch (error) {
    console.log(`\n${file}`);
    console.log(`  not ok - the file raised: ${error instanceof Error ? error.message : error}`);
    failures += 1;

    // A raise inside a file leaves its transaction aborted, and every statement
    // on that connection then fails with "current transaction is aborted" — so
    // one broken file used to report itself and hide every file after it.
    try {
      await sql.unsafe("rollback").simple();
    } catch {
      // Already rolled back, which is the other half of the same situation.
    }

    continue;
  }

  const tap = lines.filter((l) => /^(ok|not ok)\b/.test(l.trim()));
  const bad = tap.filter((l) => l.trim().startsWith("not ok"));
  const plan = lines.find((l) => /^\d+\.\.\d+$/.test(l.trim()));

  assertions += tap.length;
  failures += bad.length;

  console.log(`\n${file}  ${plan ?? "(no plan)"}`);
  for (const line of tap) console.log(`  ${line.trim()}`);
  for (const line of lines.filter((l) => l.trim().startsWith("#"))) console.log(`  ${line.trim()}`);

  const expected = plan ? Number(plan.trim().split("..")[1]) : tap.length;
  if (tap.length !== expected) {
    console.log(`  not ok - planned ${expected} assertions, ran ${tap.length}`);
    failures += 1;
  }
}

await sql.close();

console.log(`\n${assertions} assertions, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
