#!/usr/bin/env bash
set -euo pipefail
# T7 on Arch/Wayland. Run from the repository root after:
#   node apps/desktop/spike76/build.mjs 0.76.1
# Needs network (Data Dragon) and node on PATH for the harness only (the game never sees them).
root=$(pwd)
version=$(node -p 'require("./apps/desktop/spike77/manifest.json").version')
run=$(mktemp -d "${TMPDIR:-/tmp}/rift77.XXXXXX")
echo "Resultados: $run"
mkdir -p "$run/bin" "$run/install"
for program in which sh bash unshare true dirname readlink fusermount fusermount3 mount umount; do
	[[ -x /usr/bin/$program ]] && ln -s "/usr/bin/$program" "$run/bin/$program"
done
cp "$root/release/0.76.1/RiftLegends-0.76.1.AppImage" "$run/install/RiftLegends.AppImage"
socket=${WAYLAND_DISPLAY:?Wayland session required}
[[ $socket == /* ]] || socket="$XDG_RUNTIME_DIR/$socket"
spike=$root/apps/desktop/spike77
export run socket

# Independent reference download (curl) and manifest cross-check.
"$spike/make-manifest.sh" "$version" "$run/ref" >"$run/manifest.check.json"
node -e 'const fs=require("node:fs");const [a,b]=process.argv.slice(1).map(f=>JSON.stringify(JSON.parse(fs.readFileSync(f))));if(a!==b)process.exit(1)' "$run/manifest.check.json" "$spike/manifest.json" && echo "manifest == descarga de referencia"

appenv() { # scenario-dir step-dir mode
	env -i HOME="$1/home" XDG_CONFIG_HOME="$1/config" XDG_CACHE_HOME="$1/cache" \
		XDG_DATA_HOME="$1/data" XDG_STATE_HOME="$1/state" XDG_RUNTIME_DIR="$1/runtime" \
		PATH="$run/bin" WAYLAND_DISPLAY="$socket" LANG=C.UTF-8 \
		RIFT76_RESULTS="$2" RIFT76_TEST=dl "${@:4}"
}
APP=("$run/install/RiftLegends.AppImage" --appimage-extract-and-run --ozone-platform=wayland)
launch() { # scenario-dir step netmode [ENV=...]
	local d=$1 step=$2 net=$3 out=$1/results/$2
	mkdir -p "$out"
	local pre=()
	[[ $net == offline ]] && pre=(/usr/bin/unshare -cn)
	appenv "$d" "$out" dl "${@:4}" "${pre[@]}" "${APP[@]}" >"$out/app.log" 2>&1
	test -s "$out/dl.json"
}
snapshot() { # scenario-dir label
	local ud
	ud=$(find "$1/config" -maxdepth 2 -name ddragon -type d | head -1)
	{ [[ -n $ud ]] && cd "$ud" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum | while read -r h p; do printf '%s\t%s\t%s\n' "$p" "$(stat -c %s "$p")" "$h"; done; } >"$1/results/snapshot-$2.tsv" || true
}
newscenario() {
	mkdir -p "$1"/{home,config,cache,data,state,runtime,results}
	chmod 700 "$1/runtime"
}
proxy() { # port mode spec logfile -> pid in $PROXY_PID
	node "$spike/proxy.cjs" "$@" &
	PROXY_PID=$!
	sleep 0.5
}

scenario() { # name cutmode(cut|stall) resumemode(direct|norange) tamper(yes|no)
	local name=$1 cutmode=$2 resume=$3 tamper=$4 d=$run/$1 port=$((20000 + RANDOM % 20000))
	echo "== $name"
	newscenario "$d"
	proxy "$port" "$cutmode" "data/en_US/championFull.json:1500000" "$d/results/proxy-cut.log"
	local pp=$PROXY_PID
	if [[ $cutmode == cut ]]; then
		launch "$d" 1-cut net RIFT77_BASE="http://127.0.0.1:$port"
	else
		mkdir -p "$d/results/1-cut"
		RIFT77_BASE="http://127.0.0.1:$port" setsid bash -c "$(declare -f appenv); $(declare -p APP); \
			appenv '$d' '$d/results/1-cut' dl RIFT77_BASE=http://127.0.0.1:$port \"\${APP[@]}\"" >"$d/results/1-cut/app.log" 2>&1 &
		local gid=$!
		for _ in $(seq 1 120); do
			grep -Eq 'DL_PROGRESS data/en_US/championFull.json 1[0-9]{6}' "$d/results/1-cut/app.log" 2>/dev/null && break
			sleep 0.5
		done
		sleep 1
		kill -9 -- "-$gid" 2>/dev/null || true
		wait "$gid" 2>/dev/null || true
		echo "SIGKILL tras $(grep -c DL_PROGRESS "$d/results/1-cut/app.log") marcas de progreso" >"$d/results/1-cut/killed.txt"
	fi
	kill "$pp" 2>/dev/null || true
	snapshot "$d" 1-cut
	launch "$d" 2-offline offline
	snapshot "$d" 2-offline
	if [[ $tamper == yes ]]; then
		local part
		part=$(find "$d/config" -name 'championFull.json.part' | head -1)
		printf '\xff' | dd of="$part" bs=1 seek=100 conv=notrunc 2>/dev/null
		snapshot "$d" 2b-tampered
	fi
	if [[ $resume == norange ]]; then
		proxy "$port" norange "" "$d/results/proxy-resume.log"
		pp=$PROXY_PID
		launch "$d" 3-resume net RIFT77_BASE="http://127.0.0.1:$port"
		kill "$pp" 2>/dev/null || true
	else
		launch "$d" 3-resume net
	fi
	snapshot "$d" 3-resume
	launch "$d" 4-verify-offline offline RIFT77_ACTION=verify
	# Byte comparison with the independent reference download.
	(cd "$run/ref" && find . -type f -print0 | sort -z | xargs -0 sha256sum) | sed 's#\./##' >"$d/results/ref.sha"
	(cd "$(find "$d/config" -path "*/ddragon/$version" -type d | head -1)" && find . -type f -print0 | sort -z | xargs -0 sha256sum) | sed 's#\./##' >"$d/results/cache.sha"
	if diff -q "$d/results/ref.sha" "$d/results/cache.sha" >/dev/null; then echo "$name: cache == referencia"; else echo "$name: DIFERENCIAS"; fi
}

scenario S1-reset cut direct no
scenario S2-sigkill stall direct no
scenario S3-tampered-part cut direct yes
scenario S4-no-range cut norange no
echo "T7 completado: $run"
