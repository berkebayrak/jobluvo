import { neon } from "@neondatabase/serverless";

/** Runs one SQL statement against the pooled database and prints the rows. `npm run db:sql -- "select 1"`. */
async function main() {
  const statement = process.argv.slice(2).join(" ").trim();
  if (!statement) {
    console.error('usage: npm run db:sql -- "select ..."');
    process.exit(2);
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql.query(statement);
  if (Array.isArray(rows) && rows.length && typeof rows[0] === "object") console.table(rows);
  else console.log(rows);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
