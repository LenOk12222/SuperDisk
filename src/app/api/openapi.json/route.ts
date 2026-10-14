import { OPENAPI_SPEC } from "@/lib/openapi-spec";

export async function GET() {
  return Response.json(OPENAPI_SPEC, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
