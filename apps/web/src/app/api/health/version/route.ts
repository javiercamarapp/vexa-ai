import { NextResponse } from "next/server";
import webPackage from "../../../../../package.json";

// Build identity is public. It does not attest backend readiness or deployment
// approval. VEXA_COMPILED_REVISION is a validated build-time constant from Next.
export function GET() {
  return NextResponse.json(
    {
      contract_version: "1",
      data: {
        service: "vexa-web",
        version: webPackage.version,
        revision: process.env.VEXA_COMPILED_REVISION || null,
        status: "under_construction",
      },
      meta: { state: "scaffold" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
