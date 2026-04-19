export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#151515]">
      <section className="border-b border-[#d9ddd2] bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10 lg:px-12">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#007f73]">
              Alora Exam API
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              ALORA PAST PAPER API
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#4f564d]">
              Deploy this on Vercel, store PDFs in a public Cloudflare R2 bucket,
              and point the API at the R2-hosted catalogue.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <a
              className="rounded-lg border border-[#151515] bg-[#151515] px-4 py-3 text-center text-sm font-semibold text-white"
              href="/api/pairs?level=GCSE&subject=Maths&pageSize=5"
            >
              Try paired papers
            </a>
            <a
              className="rounded-lg border border-[#b9c2b1] bg-white px-4 py-3 text-center text-sm font-semibold text-[#151515]"
              href="/api/health"
            >
              Check health
            </a>
            <a
              className="rounded-lg border border-[#b9c2b1] bg-white px-4 py-3 text-center text-sm font-semibold text-[#151515]"
              href="https://dash.cloudflare.com"
            >
              Open Cloudflare
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1fr_1fr] lg:px-12">
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold">Vercel Environment</h2>
          <p className="leading-7 text-[#4f564d]">
            Add these variables to Vercel after you upload the generated
            catalogue to R2.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-[#d9ddd2] bg-white p-4 text-sm leading-6 text-[#22312d]">
            <code>{`PAPERS_CATALOG_URL=https://papers.yourdomain.com/catalog.json
NEXT_PUBLIC_PAPERS_CATALOG_URL=https://papers.yourdomain.com/catalog.json
CATALOG_REVALIDATE_SECONDS=3600`}</code>
          </pre>
        </div>

        <div className="space-y-5">
          <h2 className="text-2xl font-semibold">Generate Catalogue</h2>
          <p className="leading-7 text-[#4f564d]">
            Run this locally where the `A-Level` and `GCSE` folders exist, then
            upload `dist/catalog.json` to your R2 bucket.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-[#d9ddd2] bg-white p-4 text-sm leading-6 text-[#22312d]">
            <code>{`PAPERS_ROOT=/Users/paramveer/Desktop/Alora_PastPaperApi \\
PUBLIC_PAPERS_BASE_URL=https://papers.yourdomain.com \\
npm run catalog`}</code>
          </pre>
        </div>
      </section>

      <section className="border-t border-[#d9ddd2] bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 lg:px-12">
          <h2 className="text-2xl font-semibold">Endpoints</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              ["/api/pairs", "Only papers that have question paper and mark scheme."],
              ["/api/papers", "Search and filter the full public catalogue."],
              ["/api/metadata", "Levels, subjects, boards, years, and counts."],
              ["/api/health", "Confirms the API is deployed and catalogue URL is set."],
            ].map(([path, description]) => (
              <div key={path} className="rounded-lg border border-[#d9ddd2] p-5">
                <p className="font-mono text-sm font-semibold text-[#c1432e]">
                  GET {path}
                </p>
                <p className="mt-3 leading-7 text-[#4f564d]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
