"use client";

/* eslint-disable @next/next/no-img-element -- Local data URLs, including original full-resolution generated outputs. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, Images, Loader2, Palette, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { newProject, projectSchema, type Asset, type Brand, type Plan, type Project } from "@/lib/carousel/schema";
import { compressImage, downloadBlob, downloadImage, imageBytes, loadProject, readImage, saveProject } from "@/lib/client/carousel-storage";
import { makeZip } from "@/lib/client/carousel-zip";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const message = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

async function requestApi(body: unknown) {
  const serialized = JSON.stringify(body);
  if (new TextEncoder().encode(serialized).length > 4_000_000) throw new Error("Las referencias superan 4 MB. Elimina algunas y vuelve a intentarlo.");
  const response = await fetch("/api/ai/carousel", { method: "POST", headers: { "Content-Type": "application/json" }, body: serialized, signal: AbortSignal.timeout(290_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || "El servidor no completó la solicitud. Reintenta la lámina pendiente.");
  return data;
}

export function CarouselStudio({ configured }: { configured: boolean }) {
  const [project, setProject] = useState<Project>(() => newProject());
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [saved, setSaved] = useState("Cargando proyecto…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("brand");
  const [ready, setReady] = useState(configured);
  const [apiKey, setApiKey] = useState("");
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const stop = useRef(false);
  const locked = useRef(false);
  const saving = useRef<Promise<void>>(Promise.resolve());

  function persist(next: Project) {
    saving.current = saving.current.catch(() => {}).then(() => saveProject(next));
    return saving.current;
  }
  useEffect(() => {
    let active = true;
    loadProject().then((stored) => {
      if (!active) return;
      if (stored) setProject(stored);
      setStorageReady(true);
      setSaved("Guardado en este navegador");
    }).catch((cause) => { if (active) { setError(message(cause)); setSaved("Almacenamiento no disponible: descarga una copia"); } })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded || !storageReady) return;
    setSaved("Guardando…");
    const timer = setTimeout(() => {
      persist(project).then(() => setSaved("Guardado en este navegador")).catch((cause) => { setSaved("No guardado: descarga una copia"); setError(message(cause)); });
    }, 400);
    return () => clearTimeout(timer);
  }, [project, loaded, storageReady]);

  async function task(label: string, action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(label); setError("");
    try { await action(); } catch (cause) { setError(message(cause)); } finally { setBusy(""); locked.current = false; }
  }
  function changeBrand(patch: Partial<Brand>) {
    setProject((current) => ({ ...current, brand: { ...current.brand, ...patch }, plan: null, images: [] }));
  }
  function changeBrief(patch: Partial<Project["brief"]>) {
    setProject((current) => ({ ...current, brief: { ...current.brief, ...patch }, plan: null, images: [] }));
  }
  const valid = Boolean(project.brand.name.trim() && (project.brand.style.trim() || project.brand.examples.length) && (project.brief.topic.trim() || project.brief.references.length));

  async function connect() {
    await task("Guardando conexión…", async () => {
      if (!apiKey.trim().startsWith("sk-")) throw new Error("Introduce una API key de OpenAI válida (sk-…).");
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ai: { openaiApiKey: apiKey.trim() } }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la clave.");
      setApiKey(""); setReady(Boolean(payload.ai?.openaiApiKeyConfigured));
      if (!payload.persisted) setError(payload.warning || "La clave solo se conservará hasta reiniciar el servidor.");
      else toast.success("Clave guardada. Su acceso se comprobará al generar.");
    });
  }
  async function analyze() {
    await task("Analizando referencias y adaptando el contenido…", async () => {
      const data = await requestApi({ action: "analyze", brand: project.brand, brief: project.brief });
      setProject((current) => ({ ...current, plan: data.plan, images: [] })); setFeedback({}); setTab("generate");
    });
  }
  async function generate(only?: number) {
    if (!project.plan) return;
    const plan = project.plan;
    await task("Preparando generación…", async () => {
      stop.current = false;
      let current = project;
      const indices = only === undefined ? plan.slides.map((_, index) => index).filter((index) => !current.images.some((item) => item.index === index)) : [only];
      for (const index of indices) {
        if (stop.current) break;
        setBusy(`Generando lámina ${index + 1} de ${plan.slides.length}… Puede tardar varios minutos.`);
        const first = current.images.find((item) => item.index === 0);
        const anchor = index > 0 && first ? await compressImage(first.data) : undefined;
        const result = await requestApi({ action: "generate", brand: current.brand, brief: { ...current.brief, references: [] }, plan, index, anchor, feedback: feedback[index] || "" });
        // Regenerating the cover changes the visual anchor; preserve existing slides for comparison.
        current = { ...current, images: [...current.images.filter((item) => item.index !== index), { index, data: result.image }].sort((a, b) => a.index - b.index) };
        setProject(current);
        if (storageReady) {
          try { await persist(current); }
          catch { throw new Error("La imagen se generó pero no pudo guardarse. Descárgala o exporta el proyecto antes de continuar."); }
        }
      }
      if (only === 0 && project.images.length > 1) toast.info("Portada actualizada. Regenera las demás láminas si deseas aplicar su nuevo estilo.");
    });
  }
  function editSlide(index: number, key: keyof Plan["slides"][number], value: string) {
    setProject((current) => current.plan ? { ...current, plan: { ...current.plan, slides: current.plan.slides.map((slide, i) => i === index ? { ...slide, [key]: value } : slide) }, images: current.images.filter((image) => image.index !== index) } : current);
  }
  function exportProject() { downloadBlob(new Blob([JSON.stringify(project)], { type: "application/json" }), "carrusel-proyecto.json"); }
  async function importProject(file: File) {
    await task("Importando copia…", async () => {
      if (file.size > 180_000_000) throw new Error("La copia supera 180 MB.");
      const parsed = projectSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error("Esta copia no es un proyecto de carrusel válido.");
      setProject(parsed.data); setFeedback({}); setTab("brand");
    });
  }
  function exportImages() {
    const files = project.images.map((image) => ({ name: `lamina-${String(image.index + 1).padStart(2, "0")}.png`, bytes: imageBytes(image.data) }));
    files.push({ name: "caption.txt", bytes: new TextEncoder().encode(project.plan?.caption || "") });
    downloadBlob(makeZip(files), "carrusel.zip");
  }

  if (!loaded) return <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tu estudio…</p>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div><p className="text-sm font-medium">Tu espacio creativo</p><p className="text-xs text-muted-foreground" role="status">{saved}. No se sincroniza entre dispositivos.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportProject}>Descargar copia</Button>
        <label className="text-xs">Restaurar copia<Input aria-label="Restaurar copia del proyecto" type="file" accept="application/json,.json" disabled={Boolean(busy)} className="w-48" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importProject(file); }} /></label>
        <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => { exportProject(); setProject(newProject(project.brand)); setFeedback({}); setTab("reference"); }}>Nuevo carrusel (descarga el actual)</Button>
      </div>
    </div>
    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">OpenAI API · {ready ? "Clave configurada" : "Conecta tu cuenta"}</p><Link className="text-sm text-primary underline" href="/settings">Ajustes y conexiones</Link></div>
      <p className="text-xs text-muted-foreground">La API se factura por separado de ChatGPT. Cada análisis y generación consume saldo. La clave se guarda en el servidor de este dashboard; no se incluye en las copias del proyecto.</p>
      <div className="flex flex-wrap gap-2"><Input className="max-w-md" aria-label="API key de OpenAI" type="password" autoComplete="off" placeholder={ready ? "Nueva API key (opcional)" : "sk-…"} value={apiKey} disabled={Boolean(busy)} onChange={(event) => setApiKey(event.target.value)} /><Button variant="outline" disabled={Boolean(busy) || !apiKey.trim()} onClick={connect}>Guardar API key</Button></div>
    </CardContent></Card>
    {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</div>}
    {busy && <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-primary/10 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{busy}{busy.startsWith("Generando") && <Button variant="outline" size="sm" onClick={() => { stop.current = true; toast.info("Se detendrá después de terminar la lámina actual."); }}>Detener después de esta lámina</Button>}</div>}
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-auto flex-wrap"><TabsTrigger value="brand"><Palette className="mr-2 h-4 w-4" />1. Mi identidad</TabsTrigger><TabsTrigger value="reference"><Images className="mr-2 h-4 w-4" />2. Referencia y tema</TabsTrigger><TabsTrigger value="generate"><Sparkles className="mr-2 h-4 w-4" />3. Mi carrusel</TabsTrigger></TabsList>
      <TabsContent value="brand"><fieldset disabled={Boolean(busy)} className="space-y-4">
        <Card><CardHeader><CardTitle>La base de todos tus carruseles</CardTitle><p className="text-sm text-muted-foreground">Tu identidad manda sobre el estilo de la referencia original. Cambiarla reinicia el guion y los resultados del carrusel actual; descarga una copia para conservarlos.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          {([ ["name", "Nombre de marca", "Tu nombre o marca"], ["colors", "Paleta de colores", "Ej. negro #151515, crema #F7F1E8, acento coral #E76F51"], ["typography", "Tipografías y jerarquía", "Ej. títulos sans serif en negrita, cuerpos ligeros"], ["audience", "Público", "¿A quién te diriges?"], ["tone", "Tono de voz", "Ej. cercano, educativo, directo"], ["style", "Estilo y diseño", "Describe composición, fondos, fotografía, ilustración, texturas…"], ["rules", "Reglas de marca", "Ej. logo discreto abajo, mucho espacio, sin degradados…"] ] as const).map(([key, label, placeholder]) => <label key={key} className="space-y-2 text-sm">{label}<Textarea value={project.brand[key]} maxLength={key === "name" ? 120 : key === "colors" || key === "typography" ? 500 : key === "style" ? 3000 : key === "rules" ? 2000 : 1000} rows={key === "style" || key === "rules" ? 3 : 2} placeholder={placeholder} onChange={(event) => changeBrand({ [key]: event.target.value })} /></label>)}
        </CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2"><AssetPicker title="Logo de tu marca" assets={project.brand.logo ? [project.brand.logo] : []} max={1} disabled={Boolean(busy)} onChange={(assets) => changeBrand({ logo: assets[0] || null })} run={task} /><AssetPicker title="Diseños que representan tu estilo" assets={project.brand.examples} max={5} disabled={Boolean(busy)} onChange={(assets) => changeBrand({ examples: assets })} run={task} /></div>
        <Button onClick={() => setTab("reference")}>Continuar con la referencia<ArrowRight /></Button>
      </fieldset></TabsContent>
      <TabsContent value="reference"><fieldset disabled={Boolean(busy)} className="space-y-4">
        <Card><CardHeader><CardTitle>¿Qué quieres contar?</CardTitle><p className="text-sm text-muted-foreground">Sube el carrusel original en orden o escribe una temática. Puedes combinar ambos. Cambiar estas opciones reinicia el guion y las imágenes actuales.</p></CardHeader><CardContent className="space-y-4">
          <label className="block space-y-2 text-sm">Tema y adaptación<Textarea rows={4} maxLength={3000} placeholder="Ej. Adapta este carrusel de productividad a emprendedores, con ejemplos propios y una invitación a seguirme." value={project.brief.topic} onChange={(event) => changeBrief({ topic: event.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-3"><label className="space-y-2 text-sm">Láminas<select className={selectClass} value={project.brief.count} onChange={(event) => changeBrief({ count: Number(event.target.value) })}>{Array.from({ length: 11 }, (_, i) => <option key={i + 2} value={i + 2}>{i + 2} láminas</option>)}</select></label>
            <label className="space-y-2 text-sm">Formato<select className={selectClass} value={project.brief.size} onChange={(event) => changeBrief({ size: event.target.value as Project["brief"]["size"] })}><option value="1024x1280">Carrusel 4:5 · 1024 × 1280</option><option value="1024x1536">Vertical 2:3 · 1024 × 1536</option><option value="1024x1024">Cuadrado · 1024 × 1024</option><option value="1536x1024">Horizontal · 1536 × 1024</option></select></label>
            <label className="space-y-2 text-sm">Calidad<select className={selectClass} value={project.brief.quality} onChange={(event) => changeBrief({ quality: event.target.value as Project["brief"]["quality"] })}><option value="low">Borrador · menor consumo</option><option value="medium">Media</option><option value="high">Alta · mayor consumo</option></select></label></div>
        </CardContent></Card>
        <AssetPicker title="Carrusel original · orden de lectura" assets={project.brief.references} max={12} disabled={Boolean(busy)} onChange={(assets) => changeBrief({ references: assets })} run={task} />
        {!valid && <p className="text-sm text-muted-foreground">Completa el nombre y estilo de tu marca, y añade un tema o imágenes de referencia.</p>}
        <Button disabled={!ready || !valid} onClick={analyze}><Sparkles />Analizar y adaptar con IA</Button>
      </fieldset></TabsContent>
      <TabsContent value="generate"><fieldset disabled={Boolean(busy)} className="space-y-4">
        {!project.plan ? <Card><CardContent className="py-12 text-center"><Images className="mx-auto mb-4 h-10 w-10 text-primary" /><p>Tu carrusel empieza con una idea.</p><p className="mb-4 text-sm text-muted-foreground">Define tu identidad y analiza una referencia para preparar las láminas.</p><Button variant="outline" onClick={() => setTab("reference")}>Preparar mi carrusel</Button></CardContent></Card> : <>
          <Card><CardHeader><CardTitle>Contenido adaptado a {project.brand.name}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.plan.analysis}</p>
            <label className="block space-y-2 text-sm">Dirección visual común<Textarea rows={3} maxLength={3000} value={project.plan.direction} onChange={(event) => setProject((current) => ({ ...current, plan: current.plan ? { ...current.plan, direction: event.target.value } : null, images: [] }))} /></label>
            <p className="text-xs text-muted-foreground">Revisa textos y diseño antes de generar. Cada lámina será una imagen completa. La primera establece la guía visual de las siguientes. Cambiar textos descarta la imagen de esa lámina; cambiar la dirección visual descarta todas.</p>
            <div className="flex flex-wrap gap-2"><Button disabled={!ready || project.plan.slides.some((slide) => !slide.title.trim()) || project.images.length === project.plan.slides.length} onClick={() => generate()}><Sparkles />{project.images.length ? "Generar láminas pendientes" : "Generar carrusel completo"}</Button><Button variant="outline" disabled={!project.images.length} onClick={exportImages}><Download />Descargar imágenes (ZIP)</Button><span className="self-center text-xs text-muted-foreground">{project.images.length} / {project.plan.slides.length} imágenes</span></div>
          </CardContent></Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{project.plan.slides.map((slide, index) => {
            const image = project.images.find((item) => item.index === index);
            return <Card key={index}><CardHeader className="pb-3"><CardTitle className="text-base">Lámina {index + 1}{index === 0 ? " · Portada" : ""}</CardTitle></CardHeader><CardContent className="space-y-3">
              {image ? <a href={image.data} download={`lamina-${index + 1}.png`} title="Descargar imagen completa"><img src={image.data} alt={`Lámina ${index + 1}: ${slide.title}`} className="max-h-[480px] w-full rounded-md bg-muted object-contain" /></a> : <div className="flex h-40 items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">Lista para generar</div>}
              <label className="block space-y-1 text-xs">Título<Input maxLength={200} value={slide.title} onChange={(event) => editSlide(index, "title", event.target.value)} /></label>
              <label className="block space-y-1 text-xs">Texto de la lámina<Textarea maxLength={1000} rows={3} value={slide.text} onChange={(event) => editSlide(index, "text", event.target.value)} /></label>
              <label className="block space-y-1 text-xs">Composición visual<Textarea maxLength={2000} rows={3} value={slide.visual} onChange={(event) => editSlide(index, "visual", event.target.value)} /></label>
              <label className="block space-y-1 text-xs">Ajustes para esta generación<Input maxLength={2000} placeholder="Ej. texto más grande, fondo más claro" value={feedback[index] || ""} onChange={(event) => setFeedback((value) => ({ ...value, [index]: event.target.value }))} /></label>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!ready || !slide.title.trim() || (index > 0 && !project.images.some((item) => item.index === 0))} onClick={() => generate(index)}>{image ? "Regenerar lámina" : "Generar lámina"}</Button>{image && <Button size="sm" variant="ghost" onClick={() => downloadImage(image.data, index)}><Download />Descargar</Button>}</div>
              {index > 0 && !project.images.some((item) => item.index === 0) && <p className="text-xs text-muted-foreground">Genera primero la portada para establecer el estilo.</p>}
            </CardContent></Card>;
          })}</div>
          <Card><CardContent className="pt-5"><label className="block space-y-2 text-sm">Texto de publicación<Textarea maxLength={3000} rows={5} value={project.plan.caption} onChange={(event) => setProject((current) => ({ ...current, plan: current.plan ? { ...current.plan, caption: event.target.value } : null }))} /></label></CardContent></Card>
        </>}
      </fieldset></TabsContent>
    </Tabs>
  </div>;
}

function AssetPicker({ title, assets, max, disabled, onChange, run }: { title: string; assets: Asset[]; max: number; disabled: boolean; onChange: (assets: Asset[]) => void; run: (label: string, action: () => Promise<void>) => Promise<void> }) {
  function move(index: number, direction: number) { const next = [...assets]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next); }
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle><p className="text-xs text-muted-foreground">PNG, JPG o WebP · hasta {max} {max === 1 ? "imagen" : "imágenes"} · 12 MB por archivo. Las referencias se optimizan antes de enviarlas.</p></CardHeader><CardContent className="space-y-4">
    <Input type="file" accept="image/png,image/jpeg,image/webp" multiple={max > 1} aria-label={title} disabled={disabled || assets.length >= max} onChange={(event) => {
      const files = Array.from(event.target.files || []); event.target.value = "";
      if (!files.length) return;
      void run("Preparando imágenes…", async () => {
        if (assets.length + files.length > max) throw new Error(`Puedes subir hasta ${max} imágenes en este apartado.`);
        const next: Asset[] = []; for (const file of files) next.push(await readImage(file)); onChange([...assets, ...next]);
      });
    }} />
    {!!assets.length && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{assets.map((asset, index) => <div key={asset.id} className="space-y-2 rounded-lg border p-2"><img src={asset.data} alt={asset.name} className="h-32 w-full rounded bg-muted object-contain" /><p className="truncate text-xs" title={asset.name}>{index + 1}. {asset.name}</p><div className="flex gap-1"><Button type="button" variant="ghost" size="icon-sm" disabled={disabled || index === 0} aria-label={`Mover imagen ${index + 1} antes`} onClick={() => move(index, -1)}><ArrowLeft /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={disabled || index === assets.length - 1} aria-label={`Mover imagen ${index + 1} después`} onClick={() => move(index, 1)}><ArrowRight /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Quitar imagen ${index + 1}`} onClick={() => onChange(assets.filter((_, i) => i !== index))}><Trash2 /></Button></div></div>)}</div>}
  </CardContent></Card>;
}
