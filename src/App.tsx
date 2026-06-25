import { useMemo, useState, type InputHTMLAttributes } from "react";
import { SMDViewer } from "./components/SMDViewer";
import "./App.css";

interface FolderInputProps extends InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
}

function FolderInput(props: FolderInputProps) {
  return <input {...props} />;
}

interface FileEntry {
  id: string;
  file: File;
  path: string;
  name: string;
  ext: string;
}

type CategoryFilter = "all" | "showcase" | "attack" | "defense" | "hair" | "wings" | "costume" | "other";
type ModelKind = Exclude<CategoryFilter, "all" | "showcase">;

interface ModelProfile {
  kind: ModelKind;
  label: string;
  badge: string;
  showcaseReady: boolean;
  note: string;
  action: string;
}

interface ImportState {
  active: boolean;
  progress: number;
  title: string;
  detail: string;
}

const FILTERS: Array<{ id: CategoryFilter; label: string; hint: string }> = [
  { id: "all", label: "Todos", hint: "Todos os SMD" },
  { id: "showcase", label: "Catálogo", hint: "Modelos bons para preview" },
  { id: "attack", label: "Ataque", hint: "Armas: sword, axe, bow, staff..." },
  { id: "defense", label: "Defesa", hint: "Escudos, armaduras, botas, luvas" },
  { id: "hair", label: "Hair/Mask", hint: "Cabelo, máscara, capacete visual" },
  { id: "wings", label: "Asas", hint: "Asas, capas e costas" },
  { id: "costume", label: "Skins", hint: "Costume, set visual, roupas" },
  { id: "other", label: "Outros", hint: "Modelos não classificados" },
];

const TEXTURE_EXTENSIONS = ["bmp", "tga", "dds", "png", "jpg", "jpeg"];

function fileExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function filePath(file: File): string {
  return file.webkitRelativePath || file.name;
}

function fileId(file: File): string {
  return `${filePath(file)}::${file.size}::${file.lastModified}`;
}

function toEntry(file: File): FileEntry {
  return {
    id: fileId(file),
    file,
    path: filePath(file),
    name: file.name,
    ext: fileExt(file.name),
  };
}

function mergeEntries(prev: FileEntry[], incoming: FileEntry[]): FileEntry[] {
  const map = new Map(prev.map(entry => [entry.id, entry]));
  for (const entry of incoming) map.set(entry.id, entry);
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isTextureExt(ext: string): boolean {
  return TEXTURE_EXTENSIONS.includes(ext);
}

function stem(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
}

function cleanName(name: string): string {
  return stem(name).replace(/[^a-z0-9]/g, "");
}

function getProfile(entry: FileEntry): ModelProfile {
  const s = stem(entry.name);
  const compact = cleanName(entry.name);

  // Armas / itens de ataque. Cobre a convenção comum do PT: itW* / itws / itwa / itwp / etc.
  if (/^(itw|ws|wa|wp|wm|wb|wj|wd|wc|wh)/i.test(compact)
    || /(weapon|sword|axe|bow|arco|javelin|staff|wand|dagger|claw|hammer|orb|pike|spear|mace|blade|scythe|foice|phantom|crossbow|gun|arma)/i.test(s)) {
    return {
      kind: "attack",
      label: "Item de ataque",
      badge: "Ataque",
      showcaseReady: true,
      note: "Modelo ideal para Showcase: arma isolada, giro automático, textura ligada e exportação PNG.",
      action: "Use Showcase + Textura + Centralizar.",
    };
  }

  // Hair, máscara e capacetes visuais antes de defesa, para não cair como armor.
  if (/(hair|hairs|mask|msk|cap|hat|head|cabelo|face|helmetvisual|hs\b|hairs)/i.test(s)) {
    return {
      kind: "hair",
      label: "Hair / máscara",
      badge: "Hair",
      showcaseReady: true,
      note: "Bom para preview de visual de cabeça. Se aparecer pequeno, use Centralizar e ajuste zoom.",
      action: "Bom para catálogo de visual/hair.",
    };
  }

  if (/(wing|asa|back|costas|cape|manto|cloak)/i.test(s)) {
    return {
      kind: "wings",
      label: "Asa / costas",
      badge: "Asa",
      showcaseReady: true,
      note: "Ideal para preview grande, rotação e exportação PNG.",
      action: "Use Auto giro e fundo escuro.",
    };
  }

  // Defesa: itD* costuma ser visual/defesa. Inclui escudo, armor, boots, gloves etc.
  if (/^(itd|ds|da|db|dg|df|dm|dr|dh)/i.test(compact)
    || /(shield|shl|escudo|armor|armou?r|robe|dress|body|chest|boot|boots|glove|gaunt|defense|defesa|helm|helmet|bracelet|ring|amulet)/i.test(s)) {
    return {
      kind: "defense",
      label: "Item de defesa",
      badge: "Defesa",
      showcaseReady: true,
      note: "Escudo, armor, bota, luva ou parte defensiva. Para armaduras completas, o preview é isolado; personagem montado exige loader do client.",
      action: "Bom para checar textura e forma do item.",
    };
  }

  if (/(costume|skin|visual|xmas|santa|lpk|dragon|swim|wedding|hanbok|kimono|school|uniform|magic|inferno|traje|wc|brazil|argnt|franc|japan|pinoy|peru|spain|italy|chile|mexic|soldier)/i.test(s)) {
    return {
      kind: "costume",
      label: "Skin / costume",
      badge: "Skin",
      showcaseReady: true,
      note: "Funciona como peça isolada. Se for parte de personagem, pode precisar da montagem real do PristonTale.",
      action: "Use como preview de peça ou diagnóstico.",
    };
  }

  return {
    kind: "other",
    label: "Modelo SMD",
    badge: "Showcase",
    showcaseReady: true,
    note: "Modelo genérico. Se a textura não aparecer, importe também BMP/TGA/DDS/PNG com o mesmo nome ou nome esperado pelo SMD.",
    action: "Use busca por nome e painel de textura.",
  };
}

function countByFilter(models: FileEntry[]) {
  const base: Record<CategoryFilter, number> = {
    all: models.length,
    showcase: 0,
    attack: 0,
    defense: 0,
    hair: 0,
    wings: 0,
    costume: 0,
    other: 0,
  };

  for (const model of models) {
    const profile = getProfile(model);
    base[profile.kind] += 1;
    if (profile.showcaseReady) base.showcase += 1;
  }

  return base;
}

function countTexturesByExt(entries: FileEntry[]) {
  const out: Record<string, number> = { bmp: 0, tga: 0, dds: 0, png: 0, jpg: 0 };
  for (const entry of entries) {
    if (entry.ext === "jpeg") out.jpg += 1;
    else if (entry.ext in out) out[entry.ext] += 1;
  }
  return out;
}

export default function App() {
  const [smdFiles, setSmdFiles] = useState<FileEntry[]>([]);
  const [assetFiles, setAssetFiles] = useState<FileEntry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("showcase");
  const [dragging, setDragging] = useState(false);
  const [importState, setImportState] = useState<ImportState>({
    active: false,
    progress: 0,
    title: "Indexando biblioteca",
    detail: "",
  });

  const selectedModel = smdFiles.find(entry => entry.id === selectedId) ?? smdFiles[0] ?? null;
  const selectedProfile = selectedModel ? getProfile(selectedModel) : null;
  const textureFiles = assetFiles.filter(entry => isTextureExt(entry.ext));
  const counts = useMemo(() => countByFilter(smdFiles), [smdFiles]);
  const textureStats = useMemo(() => countTexturesByExt(textureFiles), [textureFiles]);
  const viewerAssets = useMemo(() => assetFiles.map(entry => entry.file), [assetFiles]);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return smdFiles.filter(entry => {
      const profile = getProfile(entry);
      const matchesQuery = !q
        || entry.path.toLowerCase().includes(q)
        || entry.name.toLowerCase().includes(q)
        || profile.label.toLowerCase().includes(q)
        || profile.kind.toLowerCase().includes(q);
      const matchesFilter = filter === "all"
        || (filter === "showcase" ? profile.showcaseReady : profile.kind === filter);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, smdFiles]);

  const displayedModels = useMemo(() => filteredModels.slice(0, 240), [filteredModels]);
  const hiddenModelCount = Math.max(0, filteredModels.length - displayedModels.length);

  const selectedTextureHint = useMemo(() => {
    if (!selectedModel) return null;
    const modelBase = cleanName(selectedModel.name);
    const exact = textureFiles.find(entry => cleanName(entry.name) === modelBase);
    const partial = textureFiles.find(entry => {
      const assetBase = cleanName(entry.name);
      return assetBase.includes(modelBase) || modelBase.includes(assetBase);
    });
    return exact ?? partial ?? null;
  }, [selectedModel, textureFiles]);

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setImportState({
      active: true,
      progress: 3,
      title: "Indexando biblioteca do cliente",
      detail: "Lendo SMD, BMP, TGA, DDS e PNG localmente. Nada é enviado ao servidor.",
    });

    const entries: FileEntry[] = [];
    const chunkSize = 450;
    for (let index = 0; index < fileArray.length; index += chunkSize) {
      const chunk = fileArray.slice(index, index + chunkSize);
      entries.push(...chunk.map(toEntry));
      const progress = Math.min(92, Math.round(((index + chunk.length) / fileArray.length) * 86) + 6);
      setImportState({
        active: true,
        progress,
        title: "Indexando biblioteca do cliente",
        detail: `${Math.min(index + chunk.length, fileArray.length).toLocaleString()} de ${fileArray.length.toLocaleString()} arquivos analisados`,
      });
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }

    const smds = entries.filter(entry => entry.ext === "smd");
    const assets = entries.filter(entry => entry.ext !== "smd");

    if (smds.length > 0) {
      setSmdFiles(prev => mergeEntries(prev, smds));
      setSelectedId(current => current || smds[0].id);
    }

    if (assets.length > 0) {
      setAssetFiles(prev => mergeEntries(prev, assets));
    }

    setImportState({
      active: true,
      progress: 100,
      title: "Biblioteca carregada",
      detail: `${smds.length.toLocaleString()} modelos e ${assets.length.toLocaleString()} assets encontrados`,
    });
    window.setTimeout(() => setImportState(prev => ({ ...prev, active: false })), 520);
  }

  function clearLibrary() {
    setSmdFiles([]);
    setAssetFiles([]);
    setSelectedId("");
    setQuery("");
    setFilter("showcase");
  }

  async function loadDemo() {
    try {
      const [smdResponse, textureResponse] = await Promise.all([fetch("/itWA101.smd"), fetch("/itwa101.bmp")]);
      if (!smdResponse.ok || !textureResponse.ok) throw new Error("Demo indisponível");
      const smd = new File([await smdResponse.blob()], "itWA101.smd", { type: "application/octet-stream" });
      const texture = new File([await textureResponse.blob()], "itwa101.bmp", { type: "image/bmp" });
      const smdEntry = toEntry(smd);
      setSmdFiles([smdEntry]);
      setAssetFiles([toEntry(texture)]);
      setSelectedId(smdEntry.id);
      setQuery("");
      setFilter("showcase");
    } catch {
      alert("Não foi possível carregar o exemplo embutido.");
    }
  }

  return (
    <div className="app-shell studio-shell professional-shell">
      <header className="topbar studio-header">
        <div className="brand-block">
          <span className="brand-mark">AT</span>
          <div>
            <h1>ALUCARD-TOOLS</h1>
            <p>Showcase profissional para SMD do PristonTale · leitura local no navegador</p>
          </div>
        </div>

        <div className="top-actions">
          <label className="action-button primary">
            Abrir tmABCD / pasta do cliente
            <FolderInput
              type="file"
              webkitdirectory=""
              multiple
              onChange={event => {
                if (event.target.files) void processFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label className="action-button">
            Abrir arquivos
            <input
              type="file"
              accept=".smd,.bmp,.tga,.dds,.png,.jpg,.jpeg,.SMD,.BMP,.TGA,.DDS,.PNG,.JPG,.JPEG"
              multiple
              onChange={event => {
                if (event.target.files) void processFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button type="button" className="action-button ghost" onClick={loadDemo}>Exemplo</button>
          <button type="button" className="action-button danger" onClick={clearLibrary} disabled={smdFiles.length === 0 && assetFiles.length === 0}>Limpar</button>
        </div>
      </header>

      <main
        className={`workspace studio-workspace ${dragging ? "dragging" : ""}`}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          void processFiles(event.dataTransfer.files);
        }}
      >
        <aside className="studio-left professional-left">
          <section className="stat-grid compact-stats">
            <div><strong>{smdFiles.length.toLocaleString()}</strong><span>modelos SMD</span></div>
            <div><strong>{textureFiles.length.toLocaleString()}</strong><span>texturas</span></div>
          </section>

          <section className="panel upload-guide professional-guide">
            <div className="panel-title-row">
              <h2>Fluxo correto</h2>
              <span>local</span>
            </div>
            <div className="guide-steps">
              <div><strong>1</strong><span>Abrir a pasta <b>tmABCD</b> ou uma pasta do item.</span></div>
              <div><strong>2</strong><span>Buscar por código: <b>itws</b>, <b>itda</b>, <b>hair</b>, <b>shield</b>.</span></div>
              <div><strong>3</strong><span>Usar Showcase + Textura + Centralizar e exportar PNG.</span></div>
            </div>
            <p className="privacy-note">SMD, BMP, TGA, DDS, PNG e JPG são lidos no navegador. Nada é enviado ao servidor.</p>
          </section>

          <section className="panel library-panel professional-library">
            <div className="panel-title-row">
              <h2>Biblioteca do cliente</h2>
              <span>{filteredModels.length.toLocaleString()}/{smdFiles.length.toLocaleString()}</span>
            </div>

            <input
              className="search-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar: itws, itda, hair, shield, wing..."
            />

            <div className="filter-tabs studio-tabs category-tabs">
              {FILTERS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  className={filter === item.id ? "active" : ""}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <small>{counts[item.id].toLocaleString()}</small>
                </button>
              ))}
            </div>

            {hiddenModelCount > 0 && (
              <div className="list-warning">
                Mostrando 240 de {filteredModels.length.toLocaleString()}. Use a busca para filtrar a tmABCD.
              </div>
            )}

            <div className="model-list studio-model-list professional-model-list">
              {displayedModels.length > 0 ? displayedModels.map(entry => {
                const active = selectedModel?.id === entry.id;
                const profile = getProfile(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`model-card studio-model-card professional-model-card kind-${profile.kind} ${active ? "active" : ""}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="model-card-head">
                      <span className="model-name">{entry.name}</span>
                      <span className={`model-badge badge-${profile.kind}`}>{profile.badge}</span>
                    </span>
                    <span className="model-path">{entry.path}</span>
                    <span className="model-meta">{readableSize(entry.file.size)} · {profile.label}</span>
                  </button>
                );
              }) : (
                <div className="empty-small">
                  Nenhum .smd nesse filtro. Abra a tmABCD ou uma pasta contendo modelo 3D e texturas.
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="studio-viewer professional-viewer">
          {selectedModel ? (
            <SMDViewer
              key={selectedModel.id}
              smdFile={selectedModel.file}
              smdPath={selectedModel.path}
              extraFiles={viewerAssets}
            />
          ) : (
            <div className="drop-hero studio-hero professional-hero">
              <div className="orb">3D</div>
              <h2>Abra a pasta do cliente para gerar preview profissional</h2>
              <p>Selecione a tmABCD ou uma pasta com SMD e texturas. Depois filtre por Ataque, Defesa, Hair, Asas ou Skins.</p>
              <div className="hero-actions">
                <label className="action-button primary large">
                  Abrir tmABCD / pasta completa
                  <FolderInput
                    type="file"
                    webkitdirectory=""
                    multiple
                    onChange={event => {
                      if (event.target.files) void processFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <label className="action-button large">
                  Abrir SMD + textura
                  <input
                    type="file"
                    accept=".smd,.bmp,.tga,.dds,.png,.jpg,.jpeg,.SMD,.BMP,.TGA,.DDS,.PNG,.JPG,.JPEG"
                    multiple
                    onChange={event => {
                      if (event.target.files) void processFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <button type="button" className="demo-link" onClick={loadDemo}>Carregar exemplo rápido</button>
            </div>
          )}
        </section>

        <aside className="studio-right professional-right">
          <section className="panel inspector-card professional-inspector">
            <div className="panel-title-row">
              <h2>Item selecionado</h2>
              <span>{selectedModel ? "ativo" : "vazio"}</span>
            </div>
            {selectedModel && selectedProfile ? (
              <div className="inspector-content">
                <strong className="inspector-title">{selectedModel.name}</strong>
                <p>{selectedModel.path}</p>
                <div className="kv-grid pro-kv">
                  <span>Categoria</span><strong>{selectedProfile.label}</strong>
                  <span>Uso</span><strong>{selectedProfile.badge}</strong>
                  <span>Tamanho</span><strong>{readableSize(selectedModel.file.size)}</strong>
                  <span>Textura provável</span><strong>{selectedTextureHint?.name ?? "o viewer detecta pelo SMD"}</strong>
                </div>
                <div className="recommendation-box professional-recommendation">
                  <strong>{selectedProfile.action}</strong>
                  <p>{selectedProfile.note}</p>
                </div>
              </div>
            ) : (
              <div className="empty-small">Nenhum modelo selecionado.</div>
            )}
          </section>

          <section className="panel usage-card professional-usage">
            <div className="panel-title-row">
              <h2>Tipos de item</h2>
              <span>PT</span>
            </div>
            <div className="usage-list pro-usage-list">
              <div><strong>Ataque</strong><span>itW*, sword, axe, bow, staff, claw, javelin.</span></div>
              <div><strong>Defesa</strong><span>itD*, armor, shield, boots, gloves, robe.</span></div>
              <div><strong>Hair/Mask</strong><span>hair, mask, cap, head e visual de cabeça.</span></div>
              <div><strong>Texturas</strong><span>Compatível com BMP, TGA, DDS, PNG, JPG.</span></div>
            </div>
          </section>

          <section className="panel texture-panel studio-assets professional-assets">
            <div className="panel-title-row">
              <h2>Texturas importadas</h2>
              <span>{textureFiles.length.toLocaleString()}</span>
            </div>
            <div className="texture-stats">
              <span>BMP <b>{textureStats.bmp}</b></span>
              <span>TGA <b>{textureStats.tga}</b></span>
              <span>DDS <b>{textureStats.dds}</b></span>
              <span>PNG <b>{textureStats.png}</b></span>
              <span>JPG <b>{textureStats.jpg}</b></span>
            </div>
            <div className="asset-list">
              {textureFiles.slice(0, 120).map(entry => (
                <div key={entry.id} className="asset-row">
                  <span>{entry.name}</span>
                  <small>{entry.ext || "file"}</small>
                </div>
              ))}
              {textureFiles.length > 120 && <div className="asset-more">+{textureFiles.length - 120} texturas</div>}
              {textureFiles.length === 0 && <div className="empty-small">BMP/TGA/DDS/PNG/JPG aparecem aqui quando forem importados.</div>}
            </div>
          </section>
        </aside>

        {importState.active && (
          <div className="app-loading-overlay" aria-live="polite">
            <div className="app-loading-card">
              <div className="app-loading-icon">AT</div>
              <h3>{importState.title}</h3>
              <p>{importState.detail}</p>
              <div className="app-loading-bar"><span style={{ width: `${importState.progress}%` }} /></div>
              <small>{Math.round(importState.progress)}%</small>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
