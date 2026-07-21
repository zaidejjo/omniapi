#!/bin/bash
# Generate .SRCINFO from a PKGBUILD by sourcing its bash variables.
# Usage: ./generate-srcinfo.sh <path/to/PKGBUILD>
#
# Produces <PKGBUILD_DIR/>.SRCINFO — the file AUR requires alongside PKGBUILD.
# This avoids needing makepkg / base-devel on CI runners.

set -euo pipefail

PKGBUILD_PATH="${1:?Usage: $0 <path/to/PKGBUILD>}"
PKGBUILD_DIR="$(dirname "$(realpath "$PKGBUILD_PATH")")"
PKGBUILD_FILE="$(basename "$PKGBUILD_PATH")"

cd "$PKGBUILD_DIR"

# Source the PKGBUILD to pull its bash variables into scope.
# This is safe as long as PKGBUILD only contains variable assignments + package().
source "$PKGBUILD_FILE"

OUT=".SRCINFO"

cat > "$OUT" << EOF
pkgname = ${pkgname}
pkgver = ${pkgver}
pkgrel = ${pkgrel}
pkgdesc = ${pkgdesc}
EOF

for _a in "${arch[@]}"; do  echo "arch = ${_a}" >> "$OUT"; done
echo "url = ${url}" >> "$OUT"
for _l in "${license[@]}"; do echo "license = ${_l}" >> "$OUT"; done
for _d in "${depends[@]}"; do echo "depends = ${_d}" >> "$OUT"; done

# optdepends may be unset — guard against that
if [[ ${#optdepends[@]} -gt 0 ]]; then
  for _o in "${optdepends[@]}"; do echo "optdepends = ${_o}" >> "$OUT"; done
fi

for _s in "${source[@]}"; do echo "source = ${_s}" >> "$OUT"; done
for _s in "${sha256sums[@]}"; do echo "sha256sums = ${_s}" >> "$OUT"; done

echo "Generated ${OUT} from ${PKGBUILD_PATH}"
