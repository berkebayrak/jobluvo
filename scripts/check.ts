import { spawnSync } from "node:child_process";
import { FlagError, parseFlags } from "@/lib/cli";

/*
 * The four checks, run on the committed tree, stopping on the first non zero
 * exit.
 *
 *   npm run check                the gate, then tsc, eslint, test, build
 *   npm run check -- --allow-dirty   the same on the working tree, labelled
 *                                    as not describing a commit
 *
 * Two failures in two days came from the chain and not from the code, and
 * both are what this closes.
 *
 * 1. A chain read output instead of exit codes, so a commit went in with a
 *    failing test. Every step here is spawned on its own, its `status` is
 *    the only thing read, and a step killed by a signal, which has no
 *    status, is a failure and not a pass. Nothing is piped, so there is no
 *    pipeline whose last command reports for the rest.
 * 2. An exit code cut a push chain and half a pull request merged. A step
 *    that fails stops the run: the steps after it are reported "not run",
 *    never blank, and the process exits with that step's code so the caller
 *    cannot read a failure as a pass.
 *
 * The gate is the third failure, the one that had not bitten yet: the checks
 * must describe a commit. `git status --porcelain` lists untracked files as
 * well as modified ones, so a script that has been run but never added, which
 * is how a migration and a backfill came to exist only in a working tree,
 * refuses the run here before a single check is spent.
 */

interface Step {
  name: string;
  command: string;
}

const STEPS: Step[] = [
  { name: "tsc", command: "npx tsc --noEmit" },
  { name: "eslint", command: "npx eslint ." },
  { name: "test", command: "npm test" },
  { name: "build", command: "npm run build" },
];

/** A command's output goes to this process's own streams; only its exit code is read back. */
function run(command: string): { code: number; ms: number } {
  const started = Date.now();
  const r = spawnSync(command, { shell: true, stdio: "inherit" });
  const ms = Date.now() - started;
  // A signal leaves status null. That is not a zero and must never be read as one.
  if (r.error) return { code: 1, ms };
  if (r.status === null) return { code: 1, ms };
  return { code: r.status, ms };
}

/**
 * Standard output of a git read, and its exit code is checked too. The arguments are
 * passed as a list and no shell is involved: `--format=%h %s` through a shell is one
 * argument split into two, and git reads the second as a path and exits 128.
 */
function git(args: string[]): string {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`git ${args.join(" ")} failed with ${r.status}: ${(r.stderr ?? "").trim()}`);
    process.exit(1);
  }
  return (r.stdout ?? "").trim();
}

function main() {
  const flags = parseFlags(process.argv.slice(2), { booleans: ["allow-dirty"] as const, values: [] as const });
  console.log("flags:", JSON.stringify(flags.booleans));

  const dirty = git(["status", "--porcelain"]);
  if (dirty && !flags.booleans["allow-dirty"]) {
    console.error("\nthe working tree is not clean, so these checks would not describe any commit:\n");
    for (const line of dirty.split("\n")) console.error("  " + line);
    console.error("\ncommit the changes, or run with --allow-dirty to check the working tree instead.");
    console.error("a line beginning ?? is a file git does not track at all.");
    process.exit(1);
  }

  const head = git(["log", "-1", "--format=%h %s"]);
  if (dirty) console.log(`\nchecking the WORKING TREE, which is not ${head.split(" ")[0]} and is not any commit`);
  else console.log(`\nchecking ${head}`);

  const results: { name: string; code: number | null; ms: number }[] = [];
  let failed: string | null = null;
  for (const step of STEPS) {
    if (failed) {
      results.push({ name: step.name, code: null, ms: 0 });
      continue;
    }
    console.log(`\n=== ${step.name}: ${step.command}`);
    const { code, ms } = run(step.command);
    results.push({ name: step.name, code, ms });
    if (code !== 0) failed = step.name;
  }

  console.log("");
  console.table(
    Object.fromEntries(results.map((r) => [r.name, { exit: r.code === null ? "not run" : r.code, seconds: r.code === null ? "" : (r.ms / 1000).toFixed(1) }])),
  );
  if (failed) {
    const code = results.find((r) => r.name === failed)!.code!;
    console.error(`${failed} exited ${code}. The checks stopped there; nothing after it was run.`);
    process.exit(code);
  }
  if (dirty) {
    console.log("all four passed on the working tree. This does not say a commit passes; run again with a clean tree before pushing.");
    process.exit(0);
  }
  console.log(`all four passed on ${head}.`);
  process.exit(0);
}

try {
  main();
} catch (e) {
  if (e instanceof FlagError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
