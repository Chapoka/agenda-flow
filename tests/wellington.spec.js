import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_WELLINGTON_EMAIL || process.env.E2E_EMAIL || "wellingtonestevesdesouza@gmail.com";
const PASSWORD = process.env.E2E_WELLINGTON_PASSWORD || process.env.E2E_PASSWORD || "";

test("Wellington admin cria usuário - deve não dar Perfil não encontrado", async ({ page }) => {
  page.on("console", msg => console.log("CONSOLE:", msg.text()));
  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      console.log(`API ${res.status()} ${res.url()}`);
      if (res.status() >= 400) {
        try { console.log("BODY:", await res.text()); } catch {}
      }
    }
    if (res.url().includes("/rest/v1/") && res.status() >= 400) {
      console.log(`REST ${res.status()} ${res.url()} ${await res.text().catch(()=> "")}`);
    }
  });

  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log("URL after login:", page.url());
  if (page.url().includes("/login")) {
    console.log("Login falhou - page content:", await page.content().then(c=>c.slice(0,2000)));
    throw new Error("Login falhou como Wellington");
  }

  await page.goto("/Settings");
  await page.waitForTimeout(3000);
  console.log("URL Settings:", page.url());
  const content = await page.content();
  console.log("Settings page has Novo Usuário:", content.includes("Novo Usu"));

  // Tenta abrir modal Novo Usuário
  const newBtn = page.getByRole("button", { name: /novo/i }).first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(2000);
    // Preenche formulário
    const email = `teste.wellington.e2e.${Date.now()}@test.com`;
    console.log("Criando usuário", email);
    // Campos dentro do modal
    const emailInput = page.locator('input[type="email"]').last();
    if (await emailInput.isVisible()) {
      await emailInput.fill(email);
    } else {
      console.log("email input não visível, tentando placeholder");
      await page.fill('input[placeholder*="mail"], input[placeholder*="e-mail"]', email).catch(()=>{});
    }
    // Nome
    const nameInput = page.locator('input[placeholder*="ome"], input[placeholder*="Nome"]' ).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("Teste E2E Filho");
    }
    // Senha
    const passInput = page.locator('input[type="password"]').first();
    if (await passInput.isVisible()) {
      await passInput.fill("Test123456!");
    }
    // Tenta salvar
    const saveBtn = page.locator('button').filter({ hasText: /salvar|criar/i }).last();
    console.log("saveBtn visible:", await saveBtn.isVisible().catch(()=>false));
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(4000);
      const bodyText = await page.content();
      console.log("Body after save:", bodyText.slice(bodyText.indexOf("Perfil"), bodyText.indexOf("Perfil")+500));
      if (bodyText.includes("Perfil de usu") || bodyText.includes("não encontrado")) {
        console.log("ERRO DETECTADO: Perfil não encontrado");
        throw new Error("Perfil de usuário não encontrado reproduzido");
      }
      // Verifica toast
      const toast = page.locator('[data-sonner-toast], .sonner, [role="status"]').first();
      if (await toast.isVisible().catch(()=>false)) {
        console.log("Toast:", await toast.textContent());
      }
    }
  } else {
    console.log("Botão Novo não encontrado - pode ser que admin não tenha permissão");
    console.log(content.slice(0,3000));
  }

  // Também verifica se empresas no modal estão filtradas (deve mostrar só 1)
  const empresaBotoes = page.locator('text=Empresas (filiais)');
  if (await empresaBotoes.isVisible().catch(()=>false)) {
    const texto = await page.locator('text=Rodriguinho').first().isVisible().catch(()=>false);
    console.log("Vazamento empresas visível? Rodriguinho:", texto);
  }
});
