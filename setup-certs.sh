#!/usr/bin/env bash
# Issue a Let's Encrypt certificate for mcp.zttmail.us using
# Cloudflare DNS-01 challenge. Works from anywhere — no inbound
# port 80/443 needed on this machine for the challenge.
#
# Requirements:
#   - sudo
#   - CF_API_TOKEN env var set (a Cloudflare API token with
#     Zone:DNS:Edit permission on the zttmail.us zone)
#
# Usage:
#   export CF_API_TOKEN=your_token_here
#   ./scripts/setup-certs.sh
#
# After success the cert lives at:
#   /etc/letsencrypt/live/mcp.zttmail.us/fullchain.pem
#   /etc/letsencrypt/live/mcp.zttmail.us/privkey.pem

set -euo pipefail

DOMAIN="${DOMAIN:-mcp.zttmail.us}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@zttmail.us}"

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "ERROR: CF_API_TOKEN is not set." >&2
  echo "Export it first: export CF_API_TOKEN=..." >&2
  exit 1
fi

echo ">> Installing certbot + cloudflare plugin..."
sudo apt-get update -qq
sudo apt-get install -y certbot python3-certbot-dns-cloudflare

echo ">> Writing Cloudflare credentials file..."
CRED_FILE="$HOME/.secrets/cloudflare.ini"
mkdir -p "$(dirname "$CRED_FILE")"
umask 077
cat > "$CRED_FILE" <<EOF
# Cloudflare API token used by certbot-dns-cloudflare.
# Needs Zone:DNS:Edit on the target zone.
dns_cloudflare_api_token = ${CF_API_TOKEN}
EOF
chmod 600 "$CRED_FILE"

echo ">> Requesting cert for ${DOMAIN} via DNS-01..."
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials "$CRED_FILE" \
  --dns-cloudflare-propagation-seconds 30 \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL"

echo ""
echo ">> Done. Cert files:"
sudo ls -l "/etc/letsencrypt/live/${DOMAIN}/"

echo ""
echo ">> To let the server (running as non-root) read the cert, either:"
echo "   (a) run the binary with sudo, or"
echo "   (b) grant read access:"
echo "       sudo chmod 0755 /etc/letsencrypt/live /etc/letsencrypt/archive"
echo "       sudo chmod 0644 /etc/letsencrypt/archive/${DOMAIN}/privkey*.pem"
echo "       (less secure — only do this if you understand the tradeoff)"
echo ""
echo ">> Binding to :443 also needs privilege. Either run with sudo, or:"
echo "   sudo setcap 'cap_net_bind_service=+ep' ./bin/mcp-server"
