// LOCAL browser QA: real login page + form, mocked auth/session/Google boundaries.
// Never uses real credentials, sends email, or contacts Production.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const root = fileURLToPath(new URL("../", import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const stubs = {
  "next/link": 'import React from "react"; export default function Link({href,children,...rest}){return <a href={href} {...rest}>{children}</a>}',
  "next/navigation": 'export function redirect(path){throw Error("Unexpected fixture server redirect: "+path)}',
  "@product/ui": 'export {Button} from "../../packages/ui/src/button.tsx";export {Card} from "../../packages/ui/src/card.tsx";export {BrandLockup} from "../../packages/ui/src/brand/brand-lockup.tsx";',
  "locale": 'export async function getDashboardI18n(){return {locale:"es-AR",t:{common:{login:"Ingresar",register:"Solicitar acceso"},web:{auth:{emailPlaceholder:"Email laboral",passwordPlaceholder:"Contraseña"}},dashboard:{forgotPassword:"Recuperar contraseña"}}}}',
  "access-profiles": 'export function getPublicAccessProfiles(){return [{key:"fixture",label:"Perfil de prueba",email:"fixture@example.invalid",role:"tenant-admin",available:true,note:"LOCAL"}]}',
  "session": 'export async function getDashboardSession(){return null} export function isDashboardSessionUpstreamUnavailable(){return false}',
  "clerk-env": 'export function isClerkConfiguredForRuntime(){return !new URLSearchParams(location.search).has("google-disabled")}',
  "dashboard-access-flags": 'export function dashboardDemoAccessAllowedForRole(){return !new URLSearchParams(location.search).has("demo-disabled")}',
  "auth-theme-control": 'import React from "react"; export function AuthThemeControl(){return <div className="dashboard-auth-theme-control">Apariencia</div>}',
  "clerk-google-super-admin-button": 'import React from "react"; export function ClerkGoogleSuperAdminButton({label,nextPath,resetSessionOnStart}){return <button type="button" data-testid="fixture-google" data-next={nextPath} data-reset={String(resetSessionOnStart)}>{label}</button>}',
};
const bundle = await build({
  stdin: { contents: 'import React,{StrictMode} from "react";import{createRoot}from"react-dom/client";import LoginPage from "./src/app/login/page.tsx";LoginPage({searchParams:Promise.resolve(Object.fromEntries(new URLSearchParams(location.search)))}).then(page=>createRoot(document.getElementById("root")).render(<StrictMode>{page}</StrictMode>));', loader: "tsx", resolveDir: root },
  bundle: true, write: false, outfile: "fixture.js", format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-auth-boundaries", setup(build) {
    build.onResolve({ filter: /^(next\/link|next\/navigation|@product\/ui)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    build.onResolve({ filter: /(?:lib\/(?:locale|access-profiles|session|clerk-env|dashboard-access-flags)|auth-theme-control|clerk-google-super-admin-button)$/ }, args => ({ path: args.path.split("/").at(-1), namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: root }));
  } }],
});
const globalCss = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const css = (await postcss([tailwindcss({ content: [`${root}/src/app/login/page.tsx`, `${root}/src/components/login-form-panel.tsx`, `${root}/../../packages/ui/src/**/*.{ts,tsx}`], theme: { extend: {} }, plugins: [] })]).process(globalCss, { from: undefined })).css + "\n" + bundle.outputFiles.find(file => file.path.endsWith(".css")).text + "\nbody{font-family:system-ui;margin:0}.container-shell{width:100%;max-width:1200px;margin:auto;padding:0 24px;box-sizing:border-box}button,input{font:inherit}";
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const server = createServer((req,res) => {
  if(req.url==="/fixture.js"){res.setHeader("Content-Type","text/javascript");res.end(js);}
  else if(req.url==="/fixture.css"){res.setHeader("Content-Type","text/css");res.end(css);}
  else if(req.method==="GET"){const theme=new URL(req.url,"http://fixture.invalid").searchParams.get("theme")==="dark"?"dark":"light";res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><html data-theme="${theme}" class="theme-${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const results=[];
if(process.env.LOGIN_QA_SCREENSHOTS_DIR) await mkdir(process.env.LOGIN_QA_SCREENSHOTS_DIR,{recursive:true});
try {
  for(const width of [320,390,1440]) for(const theme of ["light","dark"]) {
    const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();
    const errors=[];const posts=[];let releaseResponse;
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
      if(url.pathname!=="/api/session/login")return route.continue();
      posts.push(route.request().postDataJSON());await new Promise(resolve=>{releaseResponse=resolve});
      return route.fulfill({status:401,json:{ok:false,reason:"invalid_credentials"}});
    });
    await page.goto(`${origin}/login?theme=${theme}&next=%2Fevents%3Frange%3D24h`);
    const email=page.getByLabel("Correo electrónico",{exact:true});const password=page.getByLabel("Contraseña",{exact:true});
    await email.waitFor();assert.equal(await email.inputValue(),"","Preset must never impersonate an active account");
    const submit=page.locator('#tenant-credentials button[type="submit"]');
    const bounds=await submit.boundingBox();assert.ok(bounds.y+bounds.height<844,`Primary submit visible at ${width}: ${JSON.stringify(bounds)}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,"No horizontal overflow");
    assert.equal(await page.locator("h1").count(),1);
    if(process.env.LOGIN_QA_SCREENSHOTS_DIR) await page.screenshot({path:join(process.env.LOGIN_QA_SCREENSHOTS_DIR,`login-local-${width}-${theme}.png`),fullPage:true});
    await submit.click();assert.equal(posts.length,0,"Native required validation before auth request");
    await email.fill("fixture@example.invalid");await password.fill("fixture-only-not-a-real-password");
    await page.getByRole("button",{name:"Mostrar contraseña",exact:true}).click();assert.equal(await password.getAttribute("type"),"text");
    await page.getByRole("button",{name:"Ocultar contraseña",exact:true}).click();assert.equal(await password.getAttribute("type"),"password");
    await password.press("Enter");await page.waitForFunction(()=>document.querySelector('#tenant-credentials').getAttribute('aria-busy')==='true');
    await page.evaluate(()=>document.querySelector('#tenant-credentials').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(posts.length,1,"Enter + repeated submit must make one request");assert.equal(await submit.isDisabled(),true);
    assert.match(await submit.textContent(),/Verificando acceso/);releaseResponse();
    await page.getByRole("alert").waitFor();assert.equal(await submit.isEnabled(),true);
    assert.equal(await email.inputValue(),"fixture@example.invalid");assert.equal(await password.inputValue(),"fixture-only-not-a-real-password");
    assert.match(await page.getByTestId("login-bodega-demo-card").textContent(),/No muestra tus TAP físicos/);
    const demoAction=await page.getByTestId("login-bodega-demo-button").evaluate(el=>el.form.getAttribute("action"));
    assert.match(demoAction,/next=%2Fevents%3Frange%3D24h/);
    await page.locator("summary").filter({hasText:"Super Admin"}).click();assert.equal(await page.getByTestId("fixture-google").getAttribute("data-next"),"/events?range=24h");
    assert.deepEqual(errors,[]);
    results.push({width,theme,submitBottom:Math.ceil(bounds.y+bounds.height),authPosts:posts.length,preservedCredentials:true,pass:true});
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
  await page.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(`${origin}/login?auth_error=clerk_session_invalid&next=//external.invalid`);
  await page.getByTestId("fixture-google").waitFor();assert.equal(await page.getByTestId("fixture-google").getAttribute("data-reset"),"true");assert.equal(await page.getByTestId("fixture-google").getAttribute("data-next"),"/");
  await page.goto(`${origin}/login?demo-disabled=1&google-disabled=1`);await page.getByLabel("Correo electrónico",{exact:true}).waitFor();assert.equal(await page.getByTestId("login-bodega-demo-button").count(),0);
  await page.locator("summary").filter({hasText:"Super Admin"}).click();await page.getByTestId("login-clerk-config-warning").waitFor();assert.equal(await page.getByTestId("fixture-google").count(),0);
  results.push({scenario:"recovery and unavailable options fail closed",pass:true});await context.close();
  console.log(JSON.stringify({scope:"LOCAL mocked-auth browser QA; not a real account login",results},null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
