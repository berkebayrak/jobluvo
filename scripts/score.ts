import { scoreBatch } from "@/server/match/run";

/**
 * One scoring batch, what the cron does, run by hand. Claims the fresh slice
 * plus rework rows for every user with a profile and prints one line per
 * call. `npm run score`, or `npm run score -- --batch 5`.
 */
async function main() {
  const i = process.argv.indexOf("--batch");
  const batch = i >= 0 ? Number(process.argv[i + 1]) : undefined;
  const runs = await scoreBatch({ batch });
  for (const r of runs) {
    console.log(`user ${r.userId}: claimed ${r.claimed} (${r.fresh} new, ${r.rework} rework), scored ${r.scored}, failed ${r.failed}, usd ${r.usd}`);
    for (const l of r.lines) {
      console.log(
        l.ok
          ? `  ok     ${l.jobId}  score ${l.score}  in ${l.tokensIn} (cached ${l.tokensCached}) out ${l.tokensOut}  usd ${l.usd.toFixed(6)}  ${l.ms}ms`
          : `  failed ${l.jobId}  ${l.error}`,
      );
    }
  }
  if (!runs.length) console.log("no user has a confirmed profile");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
