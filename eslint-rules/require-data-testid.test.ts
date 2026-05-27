import { RuleTester } from 'eslint';
import rule from './require-data-testid.js';

// RuleTester internally calls Vitest's describe/it, so it must be invoked at
// the top level (not nested inside another describe/it block).
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('require-data-testid', rule, {
  valid: [
    // Native button with explicit testid.
    { code: '<button data-testid="x-y-button">Hi</button>' },
    // Native input with explicit testid.
    { code: '<input data-testid="form-email-input" />' },
    // Component (Button) with explicit testid.
    { code: '<Button data-testid="nav-foo">Hi</Button>' },
    // asChild parent renders nothing of its own; the rule skips it and checks the inner child.
    { code: '<Button asChild><Link href="/x" data-testid="cta-link">x</Link></Button>' },
    // Anchor without href is not interactive.
    { code: '<a>Just text</a>' },
    // Non-interactive native tags are ignored.
    { code: '<div onClick={() => {}}>Hi</div>' },
    // Non-listed components without href are ignored.
    { code: '<Card>Hi</Card>' },
    // Any JSX with href + testid passes — covers next-intl <Link>, next/link, etc.
    { code: '<Link href="/foo" data-testid="nav-foo-link">x</Link>' },
  ],
  invalid: [
    {
      code: '<button>Hi</button>',
      errors: [{ messageId: 'missing', data: { name: 'button' } }],
    },
    {
      code: '<input type="email" />',
      errors: [{ messageId: 'missing' }],
    },
    {
      code: '<Button onClick={() => {}}>Hi</Button>',
      errors: [{ messageId: 'missing', data: { name: 'Button' } }],
    },
    {
      code: '<Input value="" onChange={() => {}} />',
      errors: [{ messageId: 'missing', data: { name: 'Input' } }],
    },
    {
      code: '<a href="/foo">Link</a>',
      errors: [{ messageId: 'missing', data: { name: 'a' } }],
    },
    {
      code: '<form onSubmit={() => {}}>x</form>',
      errors: [{ messageId: 'missing', data: { name: 'form' } }],
    },
    // asChild parent is exempt but the inner interactive child must still carry a testid.
    {
      code: '<Button asChild><Link href="/x">x</Link></Button>',
      errors: [{ messageId: 'missing', data: { name: 'Link' } }],
    },
    // Any component with href is interactive — covers next-intl <Link>, next/link, etc.
    {
      code: '<Link href="/foo">x</Link>',
      errors: [{ messageId: 'missing', data: { name: 'Link' } }],
    },
    // Spread alone is no longer an escape hatch — explicit testid still required.
    {
      code: '<Button {...props}>Hi</Button>',
      errors: [{ messageId: 'missing', data: { name: 'Button' } }],
    },
  ],
});
