import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Dev-only: list captured game fixtures with their manifest metadata.
 *
 * Returns the contents of tests/fixtures/games/_manifest.json. The catch-up
 * lab page consumes this to populate its sidebar.
 *
 * Gated to non-production NODE_ENV — production never serves fixture data.
 */

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const manifestPath = join(
    process.cwd(),
    "tests",
    "fixtures",
    "games",
    "_manifest.json",
  );

  if (!existsSync(manifestPath)) {
    return NextResponse.json({ fixtures: [], error: "no manifest" }, { status: 200 });
  }

  try {
    const text = readFileSync(manifestPath, "utf8");
    const fixtures = JSON.parse(text) as unknown[];
    return NextResponse.json({ fixtures });
  } catch (err) {
    return NextResponse.json(
      { fixtures: [], error: err instanceof Error ? err.message : "parse error" },
      { status: 500 },
    );
  }
}
