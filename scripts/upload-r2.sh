#!/usr/bin/env bash
set -euo pipefail

: "${R2_BUCKET:?Set R2_BUCKET, for example alora-papers}"
: "${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID from the Cloudflare dashboard}"
: "${PUBLIC_PAPERS_BASE_URL:?Set PUBLIC_PAPERS_BASE_URL to your public r2.dev URL}"

PAPERS_ROOT="${PAPERS_ROOT:-/Users/paramveer/Desktop/Alora_PastPaperApi}"
AWS_PROFILE="${AWS_PROFILE:-alora-r2}"
ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "Generating catalog.json for ${PUBLIC_PAPERS_BASE_URL}"
PAPERS_ROOT="${PAPERS_ROOT}" PUBLIC_PAPERS_BASE_URL="${PUBLIC_PAPERS_BASE_URL}" npm run catalog

echo "Uploading GCSE papers..."
aws s3 sync "${PAPERS_ROOT}/GCSE" "s3://${R2_BUCKET}/GCSE" \
  --endpoint-url "${ENDPOINT_URL}" \
  --profile "${AWS_PROFILE}"

echo "Uploading A-Level papers..."
aws s3 sync "${PAPERS_ROOT}/A-Level" "s3://${R2_BUCKET}/A-Level" \
  --endpoint-url "${ENDPOINT_URL}" \
  --profile "${AWS_PROFILE}"

echo "Uploading catalog.json..."
aws s3 cp "dist/catalog.json" "s3://${R2_BUCKET}/catalog.json" \
  --endpoint-url "${ENDPOINT_URL}" \
  --profile "${AWS_PROFILE}" \
  --content-type "application/json"

echo "Done. Test ${PUBLIC_PAPERS_BASE_URL}/catalog.json"
