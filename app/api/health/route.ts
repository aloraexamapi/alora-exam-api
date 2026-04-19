import { corsOptions, jsonWithCors } from "@/app/lib/http";

export function OPTIONS() {
  return corsOptions();
}

export async function GET() {
  const catalogUrl =
    process.env.PAPERS_CATALOG_URL || process.env.NEXT_PUBLIC_PAPERS_CATALOG_URL || null;

  return jsonWithCors({
    status: "ok",
    catalogConfigured: Boolean(catalogUrl),
    catalogUrl,
  });
}
