// Spike 77 test proxy. Usage: node proxy.cjs <port> <mode> [path:bytes] [log]
// modes: pass | cut (RST after N bytes, once) | stall (hold open after N bytes, once) | norange (strip Range)
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const [port, mode, spec, logFile] = process.argv.slice(2);
const [cutPath, cutBytes] = spec
	? [spec.split(":")[0], Number(spec.split(":")[1])]
	: [];
let fired = false;
const log = (o) =>
	logFile &&
	fs.appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), ...o })}\n`);
http
	.createServer((req, res) => {
		const headers = {
			"accept-encoding": "identity",
			host: "ddragon.leagueoflegends.com",
		};
		if (mode !== "norange")
			for (const h of ["range", "if-range"])
				if (req.headers[h]) headers[h] = req.headers[h];
		const up = https.get(
			`https://ddragon.leagueoflegends.com${req.url}`,
			{ headers },
			(r) => {
				const out = { ...r.headers };
				if (mode === "norange") delete out["accept-ranges"];
				res.writeHead(r.statusCode, out);
				const target =
					(mode === "cut" || mode === "stall") &&
					!fired &&
					req.url.endsWith(cutPath) &&
					r.statusCode === 200;
				log({
					url: req.url,
					range: req.headers.range,
					status: r.statusCode,
					target,
				});
				let sent = 0;
				r.on("data", (chunk) => {
					if (!target) return void res.write(chunk);
					const room = cutBytes - sent;
					if (room <= 0) return;
					const piece = chunk.subarray(0, room);
					sent += piece.length;
					res.write(piece, () => {
						if (sent >= cutBytes && !fired) {
							fired = true;
							log({ url: req.url, event: mode, sent });
							if (mode === "cut") req.socket.destroy();
						}
					});
					if (sent >= cutBytes) r.destroy();
				});
				r.on("end", () => !target && res.end());
			},
		);
		up.on("error", () => res.destroy());
	})
	.listen(Number(port), "127.0.0.1");
