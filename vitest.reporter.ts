import type { Reporter, TestModule } from "vitest/node";

/**
 * Says at the end of the run how many tests were skipped and why, so a
 * clean clone without .env.local cannot read "passed" as "everything ran".
 * The only skip in this suite is the database backed hard filter test, which
 * needs DATABASE_URL.
 */
export default class SkipReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
    let skipped = 0;
    for (const m of testModules) for (const t of m.children.allTests()) if (t.result().state === "skipped") skipped += 1;
    if (!skipped) return;
    const why = process.env.DATABASE_URL
      ? "DATABASE_URL is set, so this is not the database gate; look at the skipped names above."
      : "DATABASE_URL is not set, so the database backed hard filter tests did not run. Create .env.local from .env.example to run them.";
    process.stdout.write(`\n${skipped} test${skipped === 1 ? "" : "s"} skipped. ${why}\n\n`);
  }
}
