import { NextResponse } from "next/server";
import webPackage from "../../../../../package.json";

// This public endpoint describes this scaffold, not backend readiness.
// No environment variables, credentials, tenant data or service probes.
export function GET() {
  return NextResponse.json(
    {
      contract_version: "1",
      data: {
        service: "vexa-web",
        version: webPackage.version,
        revision: null,
        status: "under_construction",
      },
      meta: { state: "scaffold" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
