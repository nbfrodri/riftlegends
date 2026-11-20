#!/usr/bin/env bash
set -euo pipefail
# Run in a Wayland session after building A and B, from the repository root.
root=$(pwd)
run=$(mktemp -d "${TMPDIR:-/tmp}/rift76.XXXXXX")
echo "Resultados: $run"
mkdir -p "$run"/{install,bin,home,config,cache,data,state,runtime,results}
chmod 700 "$run/runtime"
for program in which sh bash unshare true dirname readlink fusermount fusermount3 mount umount; do
	if [[ -x /usr/bin/$program ]]; then
		ln -s "/usr/bin/$program" "$run/bin/$program"
	fi
done
socket=${WAYLAND_DISPLAY:?Wayland session required}
[[ $socket == /* ]] || socket="$XDG_RUNTIME_DIR/$socket"
launch() {
	# Only the compositor socket is shared with the existing desktop session.
	env -i HOME="$run/home" XDG_CONFIG_HOME="$run/config" XDG_CACHE_HOME="$run/cache" \
		XDG_DATA_HOME="$run/data" XDG_STATE_HOME="$run/state" XDG_RUNTIME_DIR="$run/runtime" \
		PATH="$run/bin" WAYLAND_DISPLAY="$socket" LANG=C.UTF-8 \
		RIFT76_RESULTS="$run/results" RIFT76_TEST="$1" \
		/usr/bin/unshare -cn "$run/install/RiftLegends.AppImage" --appimage-extract-and-run --ozone-platform=wayland \
		>"$run/results/$1.log" 2>&1
	test -s "$run/results/$1.json"
}
cp "$root/release/0.76.1/RiftLegends-0.76.1.AppImage" "$run/install/RiftLegends.AppImage"
launch create
launch reopen
launch recovery
cp "$root/release/0.76.2/RiftLegends-0.76.2.AppImage" "$run/install/RiftLegends.AppImage"
launch upgrade
cp "$run/results/2-none.sqlite" "$run/results/cross.sqlite"
launch cross
echo "T5 y T6 automatizados completados: $run/results"
