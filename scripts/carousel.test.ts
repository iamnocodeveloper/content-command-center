import assert from "node:assert/strict";
import { test, after } from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { newProject, projectSchema, type Plan, type Asset } from "../lib/carousel/schema";
import { analyzeCarousel, generateCarouselSlide } from "../lib/services/carousel";
import { POST } from "../app/api/ai/carousel/route";
import { makeZip } from "../lib/client/carousel-zip";

// Never load or use the installation's credentials and never contact OpenAI.
process.env.DATA_DIR = join(tmpdir(), `carousel-tests-${crypto.randomUUID()}`);
process.env.OPENAI_API_KEY = "sk-test-not-real";
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
const asset = (name: string): Asset => ({ id: name, name, data: "data:image/png;base64,iVBORw0KGgo=" });
const project = newProject({ name: "Mi marca", colors: "#112233", typography: "Sans serif", style: "Editorial limpio", audience: "Creadores", tone: "Cercano", rules: "Márgenes amplios", logo: asset("logo"), examples: [asset("estilo")] });
project.brief.references = [asset("original-1"), asset("original-2")]; project.brief.count = 2;
const plan: Plan = { analysis: "Adaptación", direction: "Editorial de mi marca", caption: "Caption", slides: [{ title: "Portada", text: "Aprende algo", visual: "Título central" }, { title: "Cierre", text: "Guárdalo", visual: "CTA" }] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const req = (body: unknown, headers: Record<string, string> = {}) => new NextRequest("http://localhost:3000/api/ai/carousel", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

test("analysis sends brand and original images separately and in order", async () => {
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /chat\/completions$/);
    const body = JSON.parse(String(init?.body));
    const content = body.messages[1].content;
    assert.equal(content.filter((item: { type: string }) => item.type === "image_url").length, 4);
    const text = content.filter((item: { type: string }) => item.type === "text").map((item: { text: string }) => item.text).join("\n");
    assert.ok(text.indexOf("logo") < text.indexOf("original-1"));
    assert.ok(text.indexOf("original-1") < text.indexOf("original-2"));
    return json({ choices: [{ message: { content: JSON.stringify(plan) } }] });
  };
  assert.deepEqual(await analyzeCarousel(project.brand, project.brief), plan);
});

test("generation uses brand + cover, excludes original references, keeps exact text and format", async () => {
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /images\/edits$/);
    assert.ok(init?.body instanceof FormData);
    const form = init.body;
    assert.equal(form.getAll("image[]").length, 3);
    assert.equal(form.get("size"), "1024x1280");
    assert.equal(form.get("quality"), "high");
    assert.equal(form.get("n"), "1");
    assert.match(String(form.get("prompt")), /Guárdalo/);
    assert.match(String(form.get("prompt")), /primera lámina/);
    assert.doesNotMatch(String(form.get("prompt")), /original-1/);
    return json({ data: [{ b64_json: "iVBORw0KGgo=" }] });
  };
  assert.match(await generateCarouselSlide({ ...project, plan, index: 1, anchor: asset("cover").data, feedback: "Más contraste" }), /^data:image\/png;base64,/);
});

test("text-only brand generates a complete cover through generations", async () => {
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /images\/generations$/);
    const body = JSON.parse(String(init?.body));
    assert.match(body.prompt, /UNA imagen final completa/);
    return json({ data: [{ b64_json: "iVBORw0KGgo=" }] });
  };
  await generateCarouselSlide({ ...project, brand: { ...project.brand, logo: null, examples: [] }, plan, index: 0, feedback: "" });
});

test("invalid AI plan and mismatched slide count fail without fake fallback", async () => {
  globalThis.fetch = async () => json({ choices: [{ message: { content: "not json" } }] });
  await assert.rejects(analyzeCarousel(project.brand, project.brief), /guion incompleto/);
  globalThis.fetch = async () => json({ choices: [{ message: { content: JSON.stringify(plan) } }] });
  await assert.rejects(analyzeCarousel(project.brand, { ...project.brief, count: 3 }), /cantidad/);
});

test("quota failure is actionable and never retried", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({ error: { code: "insufficient_quota" } }, 429); };
  await assert.rejects(generateCarouselSlide({ ...project, plan, index: 0, feedback: "" }), /saldo/);
  assert.equal(calls, 1);
});

test("API validates cross-origin requests, missing brief, body limits and slide index before calling OpenAI", async () => {
  globalThis.fetch = async () => { throw new Error("Must not call provider"); };
  const analyze = { action: "analyze", brand: project.brand, brief: project.brief };
  assert.equal((await POST(req(analyze, { origin: "https://other.example" }))).status, 403);
  assert.equal((await POST(req({ ...analyze, brief: { ...project.brief, references: [] } }))).status, 400);
  assert.equal((await POST(req(analyze, { "content-length": "4000001" }))).status, 413);
  assert.equal((await POST(req({ ...analyze, extra: "x".repeat(4_000_001) }))).status, 413);
  assert.equal((await POST(req({ action: "generate", ...project, plan, index: 11 }))).status, 400);
});

test("reference-only workflow can generate using its approved plan without resending originals", async () => {
  globalThis.fetch = async () => json({ data: [{ b64_json: "iVBORw0KGgo=" }] });
  const response = await POST(req({ action: "generate", brand: project.brand, brief: { ...project.brief, references: [] }, plan, index: 0 }));
  assert.equal(response.status, 200);
  assert.ok((await response.json()).image);
});

test("download ZIP has standard signatures and known CRC-32", async () => {
  const bytes = new Uint8Array(await makeZip([{ name: "test.txt", bytes: new TextEncoder().encode("123456789") }]).arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  const centralOffset = view.getUint32(bytes.length - 6, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
});

test("unfinished edits persist but cannot trigger paid generation", async () => {
  const draft = { ...project, plan: { ...plan, slides: [{ ...plan.slides[0], title: "" }, plan.slides[1]] } };
  assert.equal(projectSchema.safeParse(draft).success, true);
  globalThis.fetch = async () => { throw new Error("Must not call provider"); };
  assert.equal((await POST(req({ action: "generate", ...draft, index: 0 }))).status, 400);
});

test("missing API key returns a configuration error without provider calls", async () => {
  delete process.env.OPENAI_API_KEY;
  try {
    globalThis.fetch = async () => { throw new Error("Must not call provider"); };
    const response = await POST(req({ action: "analyze", brand: project.brand, brief: project.brief }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /API key/);
  } finally { process.env.OPENAI_API_KEY = "sk-test-not-real"; }
});
