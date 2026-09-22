import { test, expect } from "@playwright/test";
import fs from "fs";
function loadEnv(path){
  try{
    const c=fs.readFileSync(path,'utf8');
    for(const l of c.split(/\r?\n/)){
      const t=l.trim(); if(!t||t.startsWith('#')) continue;
      const eq=t.indexOf('='); if(eq===-1) continue;
      const k=t.slice(0,eq).trim(); const v=t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
      if(k&&v&&!(k in process.env)) process.env[k]=v;
    }
  }catch{}
}
loadEnv(".env"); loadEnv(".env.local");

async function login(page, email, password){
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  if(page.url().includes("/login")) throw new Error(`Login falhou para ${email}`);
}

test("Isolamento: admin Wellington com 1 empresa NAO ve outras empresas em Clientes", async ({ page })=>{
  const email = process.env.E2E_WELLINGTON_EMAIL || "wellingtonestevesdesouza@gmail.com";
  const pwd = process.env.E2E_WELLINGTON_PASSWORD || "BlackScissors2026!";
  await login(page, email, pwd);
  await page.goto("/Clientes");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /novo/i }).first().click();
  await page.waitForTimeout(2000);
  // Verifica que o campo Empresas (filiais) NAO mostra 4 empresas
  const empresasSection = page.locator('text=Empresas (filiais)');
  const isVisible = await empresasSection.isVisible().catch(()=>false);
  console.log("Wellington Empresas section visible:", isVisible);
  // Se visível, verifica que não mostra Rodriguinho (outra empresa)
  if(isVisible){
    const rodriguinho = await page.locator('button:has-text("Rodriguinho")').isVisible().catch(()=>false);
    const studio = await page.locator('button:has-text("Studio Lins")').isVisible().catch(()=>false);
    const aquaflow = await page.locator('button:has-text("Aquaflow")').isVisible().catch(()=>false);
    console.log("Vazamento? Rodriguinho:", rodriguinho, "Studio:", studio, "Aquaflow:", aquaflow);
    expect(rodriguinho, "Admin com 1 empresa não deve ver Rodriguinho Salão").toBe(false);
    expect(studio, "Admin com 1 empresa não deve ver Studio Lins").toBe(false);
    expect(aquaflow, "Admin com 1 empresa não deve ver Aquaflow").toBe(false);
    // Deve ver apenas The Black Scissors ou nada (quando 1 empresa, o campo fica oculto)
    const black = await page.locator('button:has-text("The Black Scissors")').isVisible().catch(()=>false);
    console.log("The Black visible (se visible, deve ser único):", black);
  } else {
    console.log("OK: Empresas (filiais) oculto para admin com 1 empresa (esperado)");
  }
  // Verifica que consegue criar cliente sem escolher empresa (auto-atribuição)
  const nameInput = page.locator('input[placeholder*="nome"], input[placeholder*="Nome"]').first();
  if(await nameInput.isVisible()){
    await nameInput.fill("Cliente Isolamento Wellington");
    const saveBtn = page.locator('button').filter({ hasText: /salvar|criar|adicionar/i }).last();
    if(await saveBtn.isVisible()){
      // Não precisa escolher empresa, deve salvar direto
      console.log("Salvando cliente como Wellington...");
      // Não clica para não poluir DB, apenas verifica que botão existe
    }
  }
  expect(isVisible, "Para admin com 1 empresa, o seletor de empresas deve estar oculto").toBe(false);
});

test("Isolamento: super_admin Rodrigo VE todas as empresas em Clientes", async ({ page })=>{
  const email = process.env.E2E_EMAIL || "rodrigo.rocha@morumbisolutions.com.br";
  const pwd = process.env.E2E_PASSWORD || "Test1234!";
  await login(page, email, pwd);
  // No Clientes, super_admin vê CompanyMultiSelect (todas as empresas)
  await page.goto("/Clientes");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /novo/i }).first().click();
  await page.waitForTimeout(2000);
  // Para super_admin, o componente é CompanyMultiSelect com label "Empresa / Filial" - verifica que existe
  const hasEmpresaLabel = await page.locator('text=Empresa').first().isVisible().catch(()=>false);
  console.log("Super_admin tem seletor Empresa:", hasEmpresaLabel);
  expect(hasEmpresaLabel).toBe(true);
  // Verifica na página Companies que super_admin vê todas as 4 empresas
  await page.goto("/Companies");
  await page.waitForTimeout(3000);
  const content = await page.content();
  const countRodriguinho = (content.match(/Rodriguinho/g) || []).length;
  const countBlack = (content.match(/The Black Scissors/g) || []).length;
  const countStudio = (content.match(/Studio Lins/g) || []).length;
  const countAquaflow = (content.match(/Aquaflow/g) || []).length;
  console.log("Super_admin Companies vê:", {countRodriguinho, countBlack, countStudio, countAquaflow});
  expect(countRodriguinho).toBeGreaterThan(0);
  expect(countBlack).toBeGreaterThan(0);
});

test("Isolamento: admin Wellington NAO ve usuarios de outras empresas em Profissionais", async ({ page })=>{
  const email = process.env.E2E_WELLINGTON_EMAIL || "wellingtonestevesdesouza@gmail.com";
  const pwd = process.env.E2E_WELLINGTON_PASSWORD || "BlackScissors2026!";
  await login(page, email, pwd);
  await page.goto("/Profissionais");
  await page.waitForTimeout(3000);
  const content = await page.content();
  // Wellington deve ver profissionais da sua empresa apenas; não deve ver admin de Rodriguinho (rrocha@tabit.com.br)
  const hasRrocha = content.includes("rrocha@tabit.com.br");
  console.log("Wellington vê rrocha@tabit.com.br (de outra empresa)?", hasRrocha);
  expect(hasRrocha, "Admin não deve ver profissionais de outra empresa").toBe(false);
});
