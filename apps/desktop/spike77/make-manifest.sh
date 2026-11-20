#!/usr/bin/env bash
# Builds manifest.json (names, sizes, SHA-256) from an independent curl download.
# Usage: make-manifest.sh <version> <out-dir-for-reference-files>
set -euo pipefail
version=$1
ref=$2
files=(data/es_ES/champion.json img/champion/Aatrox.png img/champion/Ahri.png img/champion/Akali.png
	data/en_US/championFull.json data/en_US/champion.json img/champion/Zed.png img/champion/Zyra.png)
mkdir -p "$ref"
for f in "${files[@]}"; do
	mkdir -p "$ref/$(dirname "$f")"
	curl -fsS --compressed -o "$ref/$f" "https://ddragon.leagueoflegends.com/cdn/$version/$f"
done
(cd "$ref" && for f in "${files[@]}"; do printf '%s\t%s\t%s\n' "$f" "$(stat -c %s "$f")" "$(sha256sum "$f" | cut -d' ' -f1)"; done) |
	node -e '
const lines = require("node:fs").readFileSync(0, "utf8").trim().split("\n");
const files = lines.map((l) => { const [path, size, sha256] = l.split("\t"); return { path, size: Number(size), sha256 }; });
process.stdout.write(JSON.stringify({ version: process.argv[1], files }, null, 2) + "\n");
' "$version"
