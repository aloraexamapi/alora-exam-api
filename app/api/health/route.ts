export async function GET() {
  const catalogUrl =
    process.env.PAPERS_CATALOG_URL || process.env.NEXT_PUBLIC_PAPERS_CATALOG_URL || null;

  return Response.json({
    status: "ok",
    catalogConfigured: Boolean(catalogUrl),
    catalogUrl,
  });
}
