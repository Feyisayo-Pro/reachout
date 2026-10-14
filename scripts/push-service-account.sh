#!/bin/bash
# Loads a Firebase service-account JSON into .env.local and Vercel production.
# Run this yourself. Values are read from the file and piped straight to
# their destinations; nothing is printed, echoed, or passed on a command line.
#
#   ./scripts/push-service-account.sh ~/Downloads/reachout-5720c-firebase-adminsdk-xxxx.json
set -euo pipefail
FILE="${1:?usage: $0 path/to/service-account.json}"
[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }
cd "$(dirname "$0")/.."

field() { python3 -c "import json,sys;print(json.load(open(sys.argv[1]))[sys.argv[2]],end='')" "$FILE" "$1"; }

# sanity check without printing the secret
python3 - "$FILE" << 'PY'
import json, sys
d = json.load(open(sys.argv[1]))
assert d.get("type") == "service_account", "not a service account file"
assert d["private_key"].startswith("-----BEGIN"), "no private key"
print("service account for project:", d["project_id"], "|", d["client_email"])
PY

# Vercel (production): values come from the file via stdin
field client_email | vercel env add FIREBASE_CLIENT_EMAIL production --force >/dev/null
field private_key  | vercel env add FIREBASE_PRIVATE_KEY  production --force >/dev/null
echo "pushed FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to Vercel production"

# .env.local for local dev (gitignored, chmod 600). The key is stored with
# literal \n so it fits on one line; lib/admin.js converts it back.
touch .env.local; chmod 600 .env.local
grep -vE '^(FIREBASE_CLIENT_EMAIL|FIREBASE_PRIVATE_KEY|FIREBASE_PROJECT_ID)=' .env.local > .env.local.tmp || true
{
  echo "FIREBASE_PROJECT_ID=$(field project_id)"
  echo "FIREBASE_CLIENT_EMAIL=$(field client_email)"
  echo "FIREBASE_PRIVATE_KEY=\"$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['private_key'].replace(chr(10),'\\\\n'),end='')" "$FILE")\""
} >> .env.local.tmp
mv .env.local.tmp .env.local; chmod 600 .env.local
echo "wrote .env.local"
echo
echo "Now DELETE the downloaded JSON file. It is a permanent admin credential:"
echo "  rm \"$FILE\""
