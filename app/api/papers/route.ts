import { filterPapers, getCatalog, paginatePapers } from "@/app/lib/catalog";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const catalog = await getCatalog();
    const filtered = filterPapers(catalog.papers, url.searchParams);
    const paginated = paginatePapers(filtered, url.searchParams);

    return Response.json({
      ...paginated,
      filters: Object.fromEntries(url.searchParams.entries()),
      generatedAt: catalog.generatedAt,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Catalog unavailable",
        hint: "Set PAPERS_CATALOG_URL to your public R2 catalog.json URL.",
      },
      { status: 500 }
    );
  }
}
