import { getCatalog } from "@/app/lib/catalog";

export async function GET() {
  try {
    const catalog = await getCatalog();

    return Response.json({
      generatedAt: catalog.generatedAt,
      baseUrl: catalog.baseUrl,
      counts: catalog.counts,
      metadata: catalog.metadata,
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
