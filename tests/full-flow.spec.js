import { test, expect } from "@playwright/test";
import fs from "fs";
function loadEnv(p){ try{ const c=fs.readFileSync(p,'utf8'); for(const l of c.split(/\r?\n/)){ const t=l.trim(); if(!t||t.startsWith('#')) continue; const eq=t.indexOf('='); if(eq===-1) continue; const k=t.slice(0,eq).trim(); const v=t.slice(eq+1).trim().replace(/^["']|["']$/g,''); if(k&&v&&!(k in process.env)) process.env[k]=v; } }catch{} }
loadEnv(".env"); loadEnv(".env.local");

const PAGES = ["Dashboard","Schedule","Clientes","Profissionais","Plans","PunchCards","Services","StylistLevels","Invoices","WaitingList","Templates","Companies","CalendarSettings","Settings","AuditLogs"];

async function login(page, email, pwd){
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pwd);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  if(page.url().includes("/login")) throw new Error("Login falhou "+email+" url "+page.url());
}

test("Fluxo completo super_admin sem Select is not defined", async ({ page })=>{
  const errors = [];
  page.on("pageerror", err=> { console.log("PAGEERROR:", err.message); errors.push(err.message); });
  page.on("console", msg=>{ if(msg.type()==="error") console.log("CONSOLE ERROR:", msg.text()); });
  const email = process.env.E2E_EMAIL || "rodrigo.rocha@morumbisolutions.com.br";
  const pwd = process.env.E2E_PASSWORD || "Analyse01@!";
  await login(page, email, pwd);
  for(const p of PAGES){
    console.log(`\n=== Visitando /${p} ===`);
    await page.goto(`/${p}`);
    await page.waitForTimeout(3000);
    const content = await page.content();
    const hasSelectError = content.includes("Select is not defined") || errors.some(e=>e.includes("Select is not defined"));
    if(hasSelectError) console.log(`ERRO Select em /${p}`);
    expect(hasSelectError, `Select is not defined em /${p}`).toBe(false);
    // Verifica se página carregou (não ficou em branco)
    const isAccessDenied = content.includes("Acesso Negado");
    console.log(`/${p} -> Acesso Negado? ${isAccessDenied} | URL ${page.url()}`);
    // Para super_admin, nenhuma deve ser Acesso Negado exceto talvez
    if(p==="AuditLogs" || p==="Companies" || p==="Settings" || p==="CalendarSettings"){
      // super_admin deve ver, não deve ser negado
      expect(isAccessDenied, `super_admin deveria ver /${p}`).toBe(false);
    }
    expect(errors, `Erros JS em /${p}: ${errors.join("; ")}`).toHaveLength(0);
  }
});

test("Fluxo completo admin Wellington sem Select is not defined", async ({ page })=>{
  const errors = [];
  page.on("pageerror", err=> { console.log("PAGEERROR Wellington:", err.message); errors.push(err.message); });
  const email = process.env.E2E_WELLINGTON_EMAIL || "wellingtonestevesdesouza@gmail.com";
  const pwd = process.env.E2E_WELLINGTON_PASSWORD || "Mudar123@";
  await login(page, email, pwd);
  for(const p of ["Dashboard","Schedule","Clientes","Services","WaitingList"]){
    console.log(`\n=== Wellington /${p} ===`);
    await page.goto(`/${p}`);
    await page.waitForTimeout(2500);
    const hasSelectError = errors.some(e=>e.includes("Select is not defined"));
    expect(hasSelectError, `Select is not defined em /${p} para Wellington`).toBe(false);
    expect(errors).toHaveLength(0);
  }
  // Verifica que admin vê Empresas/Config/Calendário (simples: admin vê tudo da sua empresa)
  for(const p of ["Companies","Settings","CalendarSettings"]){
    await page.goto(`/${p}`);
    await page.waitForTimeout(2000);
    const content = await page.content();
    const blocked = content.includes("Acesso Negado");
    console.log(`Wellington /${p} bloqueado? ${blocked} (esperado false para admin)`);
    expect(blocked, `Wellington admin deveria ver /${p}`).toBe(false);
  }
});

test("Fluxo profissional Davidson", async ({ page })=>{
  const errors = [];
  page.on("pageerror", err=> errors.push(err.message));
  const email="davidson.fr@hotmail.com"; const pwd="Mudar123@";
  await login(page, email, pwd);
  for(const p of ["Dashboard","Schedule","Clientes"]){
    await page.goto(`/${p}`);
    await page.waitForTimeout(2000);
    expect(errors.some(e=>e.includes("Select is not defined"))).toBe(false);
  }
  for(const p of ["Companies","Settings","CalendarSettings"]){
    await page.goto(`/${p}`);
    await page.waitForTimeout(1500);
    const c = await page.content();
    expect(c.includes("Acesso Negado")).toBe(true);
  }
});
