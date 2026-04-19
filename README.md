# Alora Exam API

Vercel-hosted JSON API for the Alora GCSE and A-Level paper catalogue.

This repo does not store PDFs. PDFs should live in a public Cloudflare R2 bucket, and this app reads the R2-hosted `catalog.json`.

## Architecture

```text
Cloudflare R2 public bucket
  A-Level/
  GCSE/
  catalog.json

Vercel Next.js app
  /api/health
  /api/pairs
  /api/papers
  /api/metadata
```

## Generate `catalog.json`

Run this locally from the repo after cloning:

```bash
PAPERS_ROOT=/Users/paramveer/Desktop/Alora_PastPaperApi \
PUBLIC_PAPERS_BASE_URL=https://papers.yourdomain.com \
npm run catalog
```

This writes:

```text
dist/catalog.json
```

Upload `dist/catalog.json`, `A-Level/`, and `GCSE/` to the root of your R2 bucket.

## Upload To Cloudflare R2

The Cloudflare dashboard only supports small manual uploads. Use the S3-compatible API through AWS CLI for the full archive.

Install AWS CLI:

```bash
brew install awscli
```

Create an R2 API token in Cloudflare:

```text
Cloudflare Dashboard
-> R2 Object Storage
-> Manage R2 API Tokens
-> Create API token
```

Then configure a local profile:

```bash
aws configure --profile alora-r2
```

Use:

```text
AWS Access Key ID: your R2 access key
AWS Secret Access Key: your R2 secret key
Default region name: auto
Default output format: json
```

Run the upload script:

```bash
R2_BUCKET=alora-papers \
R2_ACCOUNT_ID=your_cloudflare_account_id \
PUBLIC_PAPERS_BASE_URL=https://pub-your-r2-url.r2.dev \
npm run upload:r2
```

This uploads:

```text
GCSE/
A-Level/
catalog.json
```

## Vercel Environment Variables

```text
PAPERS_CATALOG_URL=https://papers.yourdomain.com/catalog.json
NEXT_PUBLIC_PAPERS_CATALOG_URL=https://papers.yourdomain.com/catalog.json
CATALOG_REVALIDATE_SECONDS=3600
```

## API Endpoints

### `GET /api/health`

Confirms the service is deployed and whether `PAPERS_CATALOG_URL` is configured.

### `GET /api/pairs`

Returns only papers with both a question paper and mark scheme.

```bash
curl "https://your-vercel-app.vercel.app/api/pairs?level=GCSE&subject=Maths&board=AQA&pageSize=10"
```

### `GET /api/papers`

Returns searchable paper records. Query params:

```text
q          Free-text search
level      GCSE or A-Level
subject    Maths, Biology, Psychology, etc.
board      AQA, OCR, Edexcel, Pearson Edexcel, WJEC, Eduqas, CCEA
year       2024, 2023, etc.
session    June, November, Specimen, etc.
type       question_paper or mark_scheme
paired     true to only return complete pairs
page       Default 1
pageSize   Default 25, max 100
```

### `GET /api/metadata`

Returns levels, subjects, boards, years, sessions, and counts.

## App Usage

Your main app can call:

```ts
const response = await fetch(
  "https://your-vercel-app.vercel.app/api/pairs?level=GCSE&subject=Maths&board=AQA"
);
const papers = await response.json();
```

Each paper includes:

```ts
paper.questionPaperUrl
paper.markSchemeUrl
paper.files.questionPaper?.url
paper.files.markScheme?.url
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
