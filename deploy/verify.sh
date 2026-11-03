#!/usr/bin/env bash
# Oracle: exits 0 iff the served site meets the security/serving requirements.
# Usage: deploy/verify.sh http://127.0.0.1:8080
set -u
BASE="${1:?base url}"
fail=0
check() { if eval "$2"; then echo "ok   - $1"; else echo "FAIL - $1"; fail=1; fi; }
hdr() { curl -s -D - -o /dev/null "$@"; }

H=$(hdr "$BASE/")
check "index 200"            '[[ "$H" =~ ^HTTP/[0-9.]+\ 200 ]]'
check "CSP strict"           'grep -qi "^content-security-policy: default-src .none.; script-src .self. .wasm-unsafe-eval.;" <<<"$H"'
check "CSP no unsafe-inline" '! grep -i "^content-security-policy" <<<"$H" | grep -q "unsafe-inline\|unsafe-eval'"'"' "'
check "frame-ancestors none" 'grep -qi "frame-ancestors .none." <<<"$H"'
check "HSTS"                 'grep -qi "^strict-transport-security: max-age=31536000" <<<"$H"'
check "nosniff"              'grep -qi "^x-content-type-options: nosniff" <<<"$H"'
check "XFO deny"             'grep -qi "^x-frame-options: DENY" <<<"$H"'
check "referrer-policy"      'grep -qi "^referrer-policy: no-referrer" <<<"$H"'
check "COOP"                 'grep -qi "^cross-origin-opener-policy: same-origin" <<<"$H"'
check "no server version"    '! grep -qiE "^server: .*[0-9]" <<<"$H"'
check "index no-cache"       'grep -qi "^cache-control: no-cache" <<<"$H"'

B=$(curl -s "$BASE/")
check "no inline <script>"   '! grep -qE "<script(>| type=\"module\">)" <<<"$B"'
check "no 3rd-party script"  '! grep -qE "<script[^>]+src=\"https?://" <<<"$B"'
check "no inline <style>"    '! grep -q "<style" <<<"$B"'

AH=$(curl -s "$BASE/loader.js" | grep -oE "pkg/[0-9a-f]{16}/" | head -1)
check "loader references hashed pkg dir" '[[ -n "$AH" ]]'
check "index references versioned loader" 'grep -qE "loader\.js\?v=[0-9a-f]{16}" <<<"$B"'
P="$BASE/$AH"
W=$(hdr "${P}vhpc26_bg.wasm")
check "wasm 200"             '[[ "$W" =~ ^HTTP/[0-9.]+\ 200 ]]'
check "wasm mime"            'grep -qi "^content-type: application/wasm" <<<"$W"'
check "wasm has CSP"         'grep -qi "^content-security-policy" <<<"$W"'
check "wasm gzip"            'hdr -H "Accept-Encoding: gzip" "${P}vhpc26_bg.wasm" | grep -qi "^content-encoding: gzip"'
J=$(hdr "${P}vhpc26.js")
check "hashed assets immutable" 'grep -qi "^cache-control: public, max-age=31536000, immutable" <<<"$J"'
check "old unhashed path gone" '[[ "$(curl -s -o /dev/null -w %{http_code} $BASE/pkg/vhpc26.js)" == 404 ]]'
check "js 200 + mime"        '[[ "$J" =~ ^HTTP/[0-9.]+\ 200 ]] && grep -qi "^content-type: application/javascript" <<<"$J"'
T=$(hdr "$BASE/cfp/cfp.text")
check "cfp text 200 + text/plain" '[[ "$T" =~ ^HTTP/[0-9.]+\ 200 ]] && grep -qi "^content-type: text/plain" <<<"$T"'
check "loader.js 200"        '[[ "$(curl -s -o /dev/null -w %{http_code} $BASE/loader.js)" == 200 ]]'
SNIP=$(curl -s "${P}vhpc26.js" | grep -oE "snippets/[A-Za-z0-9_.-]+/inline[0-9]+\.js" | head -1)
check "snippet served"       '[[ -n "$SNIP" && "$(curl -s -o /dev/null -w %{http_code} ${P}$SNIP)" == 200 ]]'
check "snippet noopener"     'curl -s "${P}$SNIP" | grep -q "noopener,noreferrer"'

for p in /pkg/ /pkg/package.json /pkg/vhpc26.d.ts /Cargo.toml /.git/config /nginx.conf /index.html.gz /../etc/passwd /%2e%2e/etc/passwd; do
  c=$(curl -s --path-as-is -o /dev/null -w %{http_code} "$BASE$p")
  check "deny $p ($c)" '[[ "$c" == 404 || "$c" == 400 ]]'
done
for m in POST PUT DELETE OPTIONS TRACE; do
  c=$(curl -s -o /dev/null -w %{http_code} -X $m "$BASE/")
  check "method $m -> 405 ($c)" '[[ "$c" == 405 ]]'
done
c=$(curl -s -o /dev/null -w %{http_code} "$BASE/nope"); E=$(hdr "$BASE/nope")
check "404 carries CSP"      'grep -qi "^content-security-policy" <<<"$E"'
exit $fail
