import type { NextConfig } from "next";

// Public build identity only. Next inlines this value into the compiled route;
// changing a runtime environment variable does not relabel an existing build.
const revision = process.env.VEXA_BUILD_REVISION ?? "";
if (revision !== "" && !/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error("VEXA_BUILD_REVISION must be a complete lowercase Git SHA");
}
const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { VEXA_COMPILED_REVISION: revision },
};

export default nextConfig;
