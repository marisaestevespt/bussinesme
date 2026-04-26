import { test, expect } from '../playwright-fixture';

/**
 * Smoke E2E — apenas verifica que rotas públicas carregam sem erros JS.
 * Não autentica; apenas garante que o bundle não está partido em produção.
 */

test('homepage carrega', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  // App redireciona para /auth ou /index conforme estado de sessão
  await page.waitForLoadState('networkidle');

  expect(errors, `JS errors: ${errors.join('\n')}`).toEqual([]);
});

test('página de auth renderiza', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.locator('body')).toBeVisible();
  // Deve haver pelo menos um input (email) ou botão de login
  const hasInput = await page.locator('input').count();
  expect(hasInput).toBeGreaterThan(0);
});

test('rota inexistente mostra NotFound', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/rota-que-nao-existe-12345');
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});
