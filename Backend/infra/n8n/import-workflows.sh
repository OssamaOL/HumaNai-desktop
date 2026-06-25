#!/bin/sh
# =============================================================================
# HumaNai — n8n Workflow Auto-Import Script
# Runs once after n8n is healthy and imports all JSON workflows via REST API.
# =============================================================================

set -e

N8N_URL="${N8N_URL:-http://humanai_n8n:5678}"
AUTH_ACTIVE="${N8N_BASIC_AUTH_ACTIVE:-false}"
USER="${N8N_BASIC_AUTH_USER:-admin}"
PASS="${N8N_BASIC_AUTH_PASSWORD:-changeme}"
WORKFLOW_DIR="/workflows"

# Build auth header
if [ "$AUTH_ACTIVE" = "true" ]; then
  AUTH_HEADER="Authorization: Basic $(echo -n "${USER}:${PASS}" | base64)"
else
  AUTH_HEADER="X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZWU3MWFmZS00MjBjLTQyZjItYTQ0MC1mYzZmNGYyMDVkNjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYTkwNWRhOWMtNThkOS00OTAzLThjMzItNmY1M2QxYjYyMGQ3IiwiaWF0IjoxNzgyMzQ5NjQ5fQ.ThxpI0KheVjMMrSQScHnSlQMFaGhlmFG4aOjBxQRCSo"
fi

echo "==> Waiting for n8n to be ready at ${N8N_URL}..."
until curl -sf "${N8N_URL}/healthz" > /dev/null 2>&1; do
  echo "    n8n not ready yet, retrying in 3s..."
  sleep 3
done
echo "==> n8n is ready."

# Import each workflow JSON
for WORKFLOW_FILE in "${WORKFLOW_DIR}"/*.json; do
  WORKFLOW_NAME=$(basename "${WORKFLOW_FILE}" .json)
  echo ""
  echo "==> Importing workflow: ${WORKFLOW_NAME}..."

  HTTP_STATUS=$(curl -s -o /tmp/n8n_import_response.json -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "${AUTH_HEADER}" \
    -d @"${WORKFLOW_FILE}" \
    "${N8N_URL}/api/v1/workflows")

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    WORKFLOW_ID=$(cat /tmp/n8n_import_response.json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "    ✓ Imported ${WORKFLOW_NAME} (id=${WORKFLOW_ID}, status=${HTTP_STATUS})"

    # Activate the workflow
    if [ -n "$WORKFLOW_ID" ]; then
      ACT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PATCH \
        -H "Content-Type: application/json" \
        -H "${AUTH_HEADER}" \
        -d '{"active":true}' \
        "${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}")
      echo "    ✓ Activated workflow (status=${ACT_STATUS})"
    fi
  else
    echo "    ! Import returned HTTP ${HTTP_STATUS} for ${WORKFLOW_NAME}"
    cat /tmp/n8n_import_response.json
    echo ""
    echo "    Hint: workflow may already exist — this is OK on restarts."
  fi
done

echo ""
echo "==> All workflows processed. n8n import complete."
