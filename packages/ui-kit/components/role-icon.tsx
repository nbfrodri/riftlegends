const rolePaths = {
	top: "M4 4h4v3h8V4h4v6l-3 3v7H7v-7l-3-3z",
	jungle: "M12 21v-8l7-6V4h-5 M12 17l-7-6V7h5",
	mid: "M12 3l9 9-9 9-9-9z",
	bot: "M9 9h6v6H9z M12 3v3 M12 18v3 M3 12h3 M18 12h3",
	support: "M4 5h16v8l-8 7-8-7z M9 11h6 M12 8v6",
};

type RoleIconProps = {
	role: keyof typeof rolePaths;
	size?: 16 | 20 | 24;
	label?: string;
};

export function RoleIcon({ role, size = 20, label }: RoleIconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinejoin="bevel"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<path d={rolePaths[role]} />
		</svg>
	);
}
