import { assertSafeInteger } from "./int";

/** Fixed-point number: an integer count of 1/10000 units. */
export type Fixed = number & { readonly __fixed: unique symbol };

export const SCALE = 10_000;

const BIG_SCALE = BigInt(SCALE);
const BIG_MAX = BigInt(Number.MAX_SAFE_INTEGER);

function checked(n: bigint): Fixed {
	if (n > BIG_MAX || n < -BIG_MAX) {
		throw new RangeError("Fixed-point overflow beyond MAX_SAFE_INTEGER");
	}
	return Number(n) as Fixed;
}

/** Integer division rounding half to even. `d` must not be zero. */
function divRound(n: bigint, d: bigint): bigint {
	const q = n / d;
	const twiceRemainder = 2n * (n % d);
	const twiceAbs = twiceRemainder < 0n ? -twiceRemainder : twiceRemainder;
	const absDivisor = d < 0n ? -d : d;
	if (twiceAbs < absDivisor || (twiceAbs === absDivisor && q % 2n === 0n)) {
		return q;
	}
	return n < 0n !== d < 0n ? q - 1n : q + 1n;
}

export function fromInt(n: number): Fixed {
	assertSafeInteger(n);
	return checked(BigInt(n) * BIG_SCALE);
}

/** Converts to a whole number, rounding half to even. */
export function toInt(f: Fixed): number {
	assertSafeInteger(f);
	return Number(divRound(BigInt(f), BIG_SCALE));
}

export function add(a: Fixed, b: Fixed): Fixed {
	assertSafeInteger(a);
	assertSafeInteger(b);
	return checked(BigInt(a) + BigInt(b));
}

export function sub(a: Fixed, b: Fixed): Fixed {
	assertSafeInteger(a);
	assertSafeInteger(b);
	return checked(BigInt(a) - BigInt(b));
}

/** Multiplies, rounding half to even. The intermediate product is exact. */
export function mul(a: Fixed, b: Fixed): Fixed {
	assertSafeInteger(a);
	assertSafeInteger(b);
	return checked(divRound(BigInt(a) * BigInt(b), BIG_SCALE));
}

/** Divides, rounding half to even. Throws on division by zero. */
export function div(a: Fixed, b: Fixed): Fixed {
	assertSafeInteger(a);
	assertSafeInteger(b);
	if (b === 0) {
		throw new RangeError("Fixed-point division by zero");
	}
	return checked(divRound(BigInt(a) * BIG_SCALE, BigInt(b)));
}
