/** Throws unless `n` is a safe integer. Core arithmetic never silently loses precision. */
export function assertSafeInteger(n: number): void {
	if (!Number.isSafeInteger(n)) {
		throw new RangeError(`Expected a safe integer, got ${n}`);
	}
}

export function min(a: number, b: number): number {
	assertSafeInteger(a);
	assertSafeInteger(b);
	return a < b ? a : b;
}

export function max(a: number, b: number): number {
	assertSafeInteger(a);
	assertSafeInteger(b);
	return a > b ? a : b;
}

export function abs(n: number): number {
	assertSafeInteger(n);
	return n < 0 ? -n : n === 0 ? 0 : n;
}

/** Restricts `n` to the inclusive range `[lo, hi]`. */
export function clamp(n: number, lo: number, hi: number): number {
	assertSafeInteger(n);
	assertSafeInteger(lo);
	assertSafeInteger(hi);
	if (lo > hi) {
		throw new RangeError(`Invalid range: ${lo} > ${hi}`);
	}
	return n < lo ? lo : n > hi ? hi : n;
}
