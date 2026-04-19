import { getCatalog } from "@/app/lib/catalog";
import { corsOptions, jsonWithCors } from "@/app/lib/http";

export function OPTIONS() {
  return corsOptions();
}

export async function GET() {
  try {
    const catalog = await getCatalog();

    return jsonWithCors({
      generatedAt: catalog.generatedAt,
      baseUrl: catalog.baseUrl,
      counts: catalog.counts,
      metadata: catalog.metadata,
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
