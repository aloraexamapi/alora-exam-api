import { filterPapers, getCatalog, paginatePapers } from "@/app/lib/catalog";
import { corsOptions, jsonWithCors } from "@/app/lib/http";

export function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    url.searchParams.set("paired", "true");

    const catalog = await getCatalog();
    const filtered = filterPapers(catalog.papers, url.searchParams);
    const paginated = paginatePapers(filtered, url.searchParams);

    return jsonWithCors({
      ...paginated,
      filters: Object.fromEntries(url.searchParams.entries()),
      generatedAt: catalog.generatedAt,
    });
  } catch (error) {
    console.error(error);

    return jsonWithCors(
      {
        error: "Catalog unavailable",
        hint: "Set PAPERS_CATALOG_URL to your public R2 catalog.json URL.",
      },
      { status: 500 }
    );
  }
}
