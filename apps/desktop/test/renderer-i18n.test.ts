import { globSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type Node,
	type SourceFile,
	SyntaxKind,
} from "typescript/unstable/ast";
import {
	isBinaryExpression,
	isCallExpression,
	isConditionalExpression,
	isIdentifier,
	isJsxAttribute,
	isJsxExpression,
	isJsxText,
	isNoSubstitutionTemplateLiteral,
	isObjectLiteralExpression,
	isParenthesizedExpression,
	isStringLiteral,
} from "typescript/unstable/ast/is";
import { API } from "typescript/unstable/sync";
import { beforeAll, expect, test } from "vitest";
import en from "../../../packages/i18n/locales/en.json" with { type: "json" };
import es from "../../../packages/i18n/locales/es.json" with { type: "json" };

const root = fileURLToPath(new URL("../../../", import.meta.url));
const visibleAttributes = new Set([
	"aria-label",
	"title",
	"placeholder",
	"alt",
]);
const hasLetters = /\p{L}/u;

const hardcodedTexts: string[] = [];
const missingKeys: string[] = [];

function inspect(file: SourceFile) {
	const location = (node: Node) => {
		const { line, character } = file.getLineAndCharacterOfPosition(
			node.getStart(),
		);
		return `${relative(root, file.fileName)}:${line + 1}:${character + 1}`;
	};
	const report = (node: Node, text: string) => {
		if (hasLetters.test(text))
			hardcodedTexts.push(`${location(node)} ${JSON.stringify(text.trim())}`);
	};

	const inspectTextExpression = (node: Node) => {
		if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node))
			report(node, node.text);
		else if (isParenthesizedExpression(node))
			inspectTextExpression(node.expression);
		else if (isConditionalExpression(node)) {
			inspectTextExpression(node.whenTrue);
			inspectTextExpression(node.whenFalse);
		} else if (isBinaryExpression(node)) {
			switch (node.operatorToken.kind) {
				case SyntaxKind.PlusToken:
				case SyntaxKind.BarBarToken:
				case SyntaxKind.QuestionQuestionToken:
					inspectTextExpression(node.left);
					// Both operands can contribute to the rendered text.
					inspectTextExpression(node.right);
					break;
				case SyntaxKind.AmpersandAmpersandToken:
					inspectTextExpression(node.right);
					break;
			}
		}
	};

	const visit = (node: Node) => {
		if (isJsxText(node)) report(node, node.text);
		if (
			isJsxAttribute(node) &&
			visibleAttributes.has(node.name.getText()) &&
			node.initializer &&
			isStringLiteral(node.initializer)
		) {
			inspectTextExpression(node.initializer);
		}
		if (
			isJsxExpression(node) &&
			node.expression &&
			(!isJsxAttribute(node.parent) ||
				visibleAttributes.has(node.parent.name.getText()))
		) {
			inspectTextExpression(node.expression);
		}
		if (
			isCallExpression(node) &&
			isIdentifier(node.expression) &&
			node.expression.text === "t"
		) {
			const [key, options] = node.arguments;
			if (
				key &&
				(isStringLiteral(key) || isNoSubstitutionTemplateLiteral(key))
			) {
				const plural =
					options &&
					isObjectLiteralExpression(options) &&
					options.properties.some(
						(property) =>
							"name" in property && property.name?.getText() === "count",
					);
				for (const [locale, catalog] of Object.entries({ en, es })) {
					const exists =
						Object.hasOwn(catalog, key.text) ||
						(plural &&
							Object.hasOwn(catalog, `${key.text}_one`) &&
							Object.hasOwn(catalog, `${key.text}_other`));
					if (!exists)
						missingKeys.push(`${location(key)} ${locale}: ${key.text}`);
				}
			}
		}
		node.forEachChild(visit);
	};
	visit(file);
}

beforeAll(() => {
	const config = join(root, "tsconfig.json");
	const api = new API({ cwd: root });
	try {
		using snapshot = api.updateSnapshot({ openProjects: [config] });
		const program = snapshot.getProject(config)?.program;
		const files = globSync("apps/desktop/src/renderer/**/*.{ts,tsx}", {
			cwd: root,
		}).sort();
		expect(files.length).toBeGreaterThan(0);
		for (const path of files) {
			const file = program?.getSourceFile(join(root, path));
			if (!file) throw new Error(`Could not parse ${path}`);
			inspect(file);
		}
	} finally {
		api.close();
	}
});

test("renderer JSX takes visible text from translations", () => {
	expect(hardcodedTexts).toEqual([]);
});

test("static renderer translation keys exist in ES and EN", () => {
	expect(missingKeys).toEqual([]);
});
