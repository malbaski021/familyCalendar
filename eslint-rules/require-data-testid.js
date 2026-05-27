/**
 * ESLint rule: require-data-testid
 *
 * Enforces `data-testid` on every interactive JSX element so tests
 * (unit and E2E) can locate it deterministically.
 *
 * Naming convention (documented in CLAUDE.md): `<context>-<component>-<element>`,
 * kebab-case. Example: `signup-form-email-input`, `nav-language-toggle`.
 *
 * Escape hatches:
 *  - The element has any `{...spread}` attribute (the testid may be inside).
 *  - The element has `asChild` (Radix Slot forwards the testid down).
 *  - The file is a test file (matched by ESLint config `files` glob).
 *
 * Options:
 *  - `nativeTags`: array of lowercase tag names treated as interactive.
 *  - `components`: array of PascalCase component names treated as interactive.
 *  - `anchorRequiresHref`: when true (default) `<a>` is only interactive if it has `href`.
 */

const DEFAULT_NATIVE_TAGS = ['button', 'input', 'select', 'textarea', 'form'];
const DEFAULT_COMPONENTS = ['Button', 'Input', 'Textarea', 'Select'];

function hasAttribute(node, name) {
  return node.attributes.some(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name,
  );
}

function hasSpread(node) {
  return node.attributes.some((attr) => attr.type === 'JSXSpreadAttribute');
}

function getElementName(node) {
  const name = node.name;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    // e.g. Slot.Root → "Slot.Root"
    const parts = [];
    let cur = name;
    while (cur.type === 'JSXMemberExpression') {
      parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type === 'JSXIdentifier') parts.unshift(cur.name);
    return parts.join('.');
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require data-testid on interactive elements so tests can locate them deterministically.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          nativeTags: {
            type: 'array',
            items: { type: 'string' },
          },
          components: {
            type: 'array',
            items: { type: 'string' },
          },
          anchorRequiresHref: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        'Interactive element <{{name}}> is missing `data-testid`. Use the convention `<context>-<component>-<element>` (kebab-case), e.g. `signup-form-email-input`.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const nativeTags = new Set(options.nativeTags ?? DEFAULT_NATIVE_TAGS);
    const components = new Set(options.components ?? DEFAULT_COMPONENTS);
    const anchorRequiresHref = options.anchorRequiresHref !== false;

    return {
      JSXOpeningElement(node) {
        const name = getElementName(node);
        if (!name) return;

        const isLowerCase = /^[a-z]/.test(name);
        let interactive = false;

        if (isLowerCase) {
          if (nativeTags.has(name)) interactive = true;
          if (name === 'a' && (!anchorRequiresHref || hasAttribute(node, 'href'))) {
            interactive = true;
          }
        } else {
          if (components.has(name)) interactive = true;
        }

        if (!interactive) return;

        // Escape hatch: spread props may carry the testid.
        if (hasSpread(node)) return;

        // `asChild` (Radix Slot) is NOT an escape hatch on its own. Slot
        // forwards `data-testid` from the parent down to the rendered child,
        // so the right place to attach a testid IS the asChild parent. If
        // the parent has the attribute we accept; otherwise the rendered
        // element ends up untestable.
        if (hasAttribute(node, 'data-testid')) return;

        context.report({ node, messageId: 'missing', data: { name } });
      },
    };
  },
};

module.exports = rule;
