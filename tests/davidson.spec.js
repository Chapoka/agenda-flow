import { test, expect } from "@playwright/test";
import fs from "fs";
function loadEnv(p){ try{ const c=fs.readFileSync(p,'utf8'); for(const l of c.split(/\r?\n/)){ const t=l.trim(); if(!t||t.startsWith('#')) continue; const eq=t.indexOf('='); if(eq===-1) continue; const k=t.slice(0,eq).trim(); const v=t.slice(eq+1).trim().replace(/^["']|["']$/g,''); if(k&&v&&!(k in process.env)) process.env[k]=v; } }catch{} }
loadEnv(".env"); loadEnv(".env.local");
async function login(page, email, pwd){
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pwd);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  if(page.url().includes("/login")) throw new Error("Login falhou "+email);
}
test("Profissional Davidson nao ve Empresas/Config/Calendario, mas ve Clientes/Agenda", async ({ page })=>{
  const email="davidson.fr@hotmail.com"; const pwd=process.env.E2E_DAVIDSON_PASSWORD || "Mudar123@";
  await login(page, email, pwd);
  await page.goto("/Companies");
  await page.waitForTimeout(2000);
  let content = await page.content();
  const blockedCompanies = content.includes("Acesso Negado") || content.includes("Acesso negado") || content.includes("404") || page.url().includes("/login") || content.includes("Page Not Found");
  console.log("Davidson Companies bloqueado:", blockedCompanies, "url", page.url());
  expect(blockedCompanies, "Profissional não deve acessar Empresas").toBe(true);

  await page.goto("/Settings");
  await page.waitForTimeout(2000);
  content = await page.content();
  const blockedSettings = content.includes("Acesso Negado") || content.includes("Acesso negado") || content.includes("404") || content.includes("Page Not Found");
  console.log("Davidson Settings bloqueado:", blockedSettings, "url", page.url());
  expect(blockedSettings).toBe(true);

  await page.goto("/CalendarSettings");
  await page.waitForTimeout(2000);
  content = await page.content();
  const blockedCal = content.includes("Acesso Negado") || content.includes("Acesso negado") || content.includes("404") || content.includes("Page Not Found");
  console.log("Davidson Calendar bloqueado:", blockedCal, "url", page.url());
  expect(blockedCal).toBe(true);

  await page.goto("/Clientes");
  await page.waitForTimeout(3000);
  content = await page.content();
  console.log("Davidson Clientes acessível:", content.includes("Clientes"));
  expect(content.includes("Clientes")).toBe(true);

  await page.goto("/Schedule");
  await page.waitForTimeout(3000);
  content = await page.content();
  console.log("Davidson Agenda acessível:", content.includes("Agenda"));
  expect(content.includes("Agenda")).toBe(true);
});
