import { globSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node } from "typescript/unstable/ast";
import { isJsxAttribute, isJsxAttributes } from "typescript/unstable/ast/is";
import { API } from "typescript/unstable/sync";
import { expect, test } from "vitest";

// Native `title` attributes show the system tooltip; components whose own
// `title` prop is a heading (they start with a capital letter) are fine.
function isNativeTitle(node: Node) {
	if (!isJsxAttribute(node) || node.name.getText() !== "title") return false;
	const attributes = node.parent;
	if (!isJsxAttributes(attributes)) return false;
	const element = attributes.parent as unknown as { tagName: Node };
	return /^[a-z]/.test(element.tagName.getText());
}

test("desktop and ui-kit elements use the Caja tooltip, not native titles", () => {
	const root = fileURLToPath(new URL("../../../", import.meta.url));
	const config = join(root, "tsconfig.json");
	const api = new API({ cwd: root });
	const violations: string[] = [];
	try {
		using snapshot = api.updateSnapshot({ openProjects: [config] });
		const program = snapshot.getProject(config)?.program;
		const files = globSync(
			["apps/desktop/src/**/*.{jsx,tsx}", "packages/ui-kit/**/*.{jsx,tsx}"],
			{
				cwd: root,
				exclude: ["**/node_modules/**", "**/dist/**"],
			},
		);
		expect(files.length).toBeGreaterThan(0);
		for (const path of files) {
			const file = program?.getSourceFile(join(root, path));
			if (!file) throw new Error(`Could not parse ${path}`);
			function visit(node: Node) {
				if (isNativeTitle(node)) {
					const { line } = node
						.getSourceFile()
						.getLineAndCharacterOfPosition(node.getStart());
					violations.push(`${path}:${line + 1}`);
				}
				node.forEachChild(visit);
			}
			visit(file);
		}
	} finally {
		api.close();
	}
	expect(violations).toEqual([]);
});
