// Shared Tailwind classes of the match panels. Styles live in utilities, not
// in a stylesheet imported from a module: in dev, Vite would inject it as an
// inline <style>, which the CSP blocks (issue #226).

export const panel =
	"min-w-0 bg-panel px-[clamp(10px,1.15vw,18px)] py-[clamp(9px,1.5vh,16px)] short:py-[9px]";

export const panelTitle =
	"font-bold font-display text-[clamp(16px,1.45vw,23px)] leading-[1.1] tracking-[-0.045em]";

/** Centred cells with a bottom rule; muted headers, team headers in their colour. */
export const panelTable =
	"mt-1.5 w-full table-fixed border-collapse [&_:is(th,td)]:border-line [&_:is(th,td)]:border-b [&_:is(th,td)]:px-0.5 [&_:is(th,td)]:py-[3px] [&_:is(th,td)]:text-center [&_:is(th,td)]:align-middle [&_thead]:text-muted [&_th[scope=colgroup]]:bg-surface [&_th[scope=colgroup]]:text-(--side)";
