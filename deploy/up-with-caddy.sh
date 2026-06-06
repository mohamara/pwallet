#!/usr/bin/env bash
set -euo pipefail

# pwallet را به همان شبکه Docker که accounter_caddy روی آن است وصل می‌کند.
# استفاده:
#   bash deploy/up-with-caddy.sh
#   CADDY_CONTAINER=accounter_caddy bash deploy/up-with-caddy.sh

CADDY_CONTAINER="${CADDY_CONTAINER:-accounter_caddy}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! docker inspect "$CADDY_CONTAINER" >/dev/null 2>&1; then
  echo "Container not found: $CADDY_CONTAINER" >&2
  exit 1
fi

mapfile -t NETWORKS < <(
  docker inspect "$CADDY_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' \
    | sed '/^$/d'
)

if [[ ${#NETWORKS[@]} -eq 0 ]]; then
  echo "No networks found for $CADDY_CONTAINER" >&2
  exit 1
fi

if [[ ${#NETWORKS[@]} -gt 1 ]]; then
  echo "Multiple networks on $CADDY_CONTAINER:"
  printf '  - %s\n' "${NETWORKS[@]}"
  echo "Set CADDY_NETWORK explicitly, e.g.:"
  echo "  CADDY_NETWORK=${NETWORKS[0]} bash deploy/up-with-caddy.sh"
  exit 1
fi

export CADDY_NETWORK="${NETWORKS[0]}"

echo "Using Docker network: $CADDY_NETWORK (from $CADDY_CONTAINER)"
echo ""
echo "Add to accounter Caddyfile:"
echo "  import ${ROOT_DIR}/deploy/caddy/pwall.dfmstock.com.docker.caddy"
echo ""
echo "Then reload accounter_caddy."
echo ""

cd "$ROOT_DIR"
docker compose -f docker-compose.yml -f deploy/docker-compose.caddy-network.yml up -d --build "$@"
