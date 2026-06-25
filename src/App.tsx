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

type CategoryFilter = "all" | "showcase" | "weapons" | "shields" | "wings" | "armor" | "textures" | "other";
type ModelKind = Exclude<CategoryFilter, "all" | "textures">;

interface ModelProfile {
  kind: ModelKind;
  label: string;
  badge: string;
  showcaseReady: boolean;
  note: string;
}

const FILTERS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "showcase", label: "Showcase OK" },
  { id: "weapons", label: "Armas" },
  { id: "shields", label: "Escudos" },
  { id: "wings", label: "Asas" },
  { id: "armor", label: "Armaduras" },
  { id: "other", label: "Outros" },
];

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
  return ["bmp", "tga", "dds", "png", "jpg", "jpeg"].includes(ext);
}

function stem(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
}

function getProfile(entry: FileEntry): ModelProfile {
  const s = stem(entry.name);

  if (/(shield|shl|escudo)/i.test(s)) {
    return {
      kind: "shields",
      label: "Escudo",
      badge: "Showcase OK",
      showcaseReady: true,
      note: "Bom para catálogo: carregue o .smd junto com as texturas e use Showcase + Textura.",
    };
  }

  if (/(wing|asa|back|costas|cape|manto)/i.test(s)) {
    return {
      kind: "wings",
      label: "Asa / visual de costas",
      badge: "Showcase OK",
      showcaseReady: true,
      note: "Ideal para preview rotativo e exportação PNG.",
    };
  }

  if (/(itwa|weapon|sword|axe|bow|arco|javelin|staff|wand|dagger|claw|hammer|orb|arma)/i.test(s)) {
    return {
      kind: "weapons",
      label: "Arma",
      badge: "Showcase OK",
      showcaseReady: true,
      note: "Modelo isolado; use Eixo PT se aparecer deitado ou invertido.",
    };
  }

  if (/(armor|armou?r|robe|dress|costume|armor-|itda|itdb|body|chest|helmet|helm|hair|mask|cap)/i.test(s)) {
    return {
      kind: "armor",
      label: "Armadura / parte visual",
      badge: "Requer teste",
      showcaseReady: true,
      note: "Funciona como preview isolado. Personagem completo ainda depende do loader real do PristonTale.",
    };
  }

  return {
    kind: "other",
    label: "Modelo SMD",
    badge: "Showcase OK",
    showcaseReady: true,
    note: "Modelo genérico. Se a textura não aparecer, confira se BMP/TGA/DDS está na mesma importação.",
  };
}

function countByFilter(models: FileEntry[], assets: FileEntry[]) {
  const base: Record<CategoryFilter, number> = {
    all: models.length,
    showcase: 0,
    weapons: 0,
    shields: 0,
    wings: 0,
    armor: 0,
    textures: assets.length,
    other: 0,
  };

  for (const model of models) {
    const profile = getProfile(model);
    base[profile.kind] += 1;
    if (profile.showcaseReady) base.showcase += 1;
  }

  return base;
}

export default function App() {
  const [smdFiles, setSmdFiles] = useState<FileEntry[]>([]);
  const [assetFiles, setAssetFiles] = useState<FileEntry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [dragging, setDragging] = useState(false);

  const selectedModel = smdFiles.find(entry => entry.id === selectedId) ?? smdFiles[0] ?? null;
  const selectedProfile = selectedModel ? getProfile(selectedModel) : null;
  const textureFiles = assetFiles.filter(entry => isTextureExt(entry.ext));
  const counts = useMemo(() => countByFilter(smdFiles, assetFiles), [smdFiles, assetFiles]);
  const viewerAssets = useMemo(() => assetFiles.map(entry => entry.file), [assetFiles]);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return smdFiles.filter(entry => {
      const profile = getProfile(entry);
      const matchesQuery = !q || entry.path.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q);
      const matchesFilter = filter === "all"
        || (filter === "showcase" ? profile.showcaseReady : profile.kind === filter);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, smdFiles]);

  const selectedTextureHint = useMemo(() => {
    if (!selectedModel) return null;
    const modelBase = stem(selectedModel.name);
    const exact = textureFiles.find(entry => stem(entry.name) === modelBase);
    const partial = textureFiles.find(entry => stem(entry.name).includes(modelBase) || modelBase.includes(stem(entry.name)));
    return exact ?? partial ?? null;
  }, [selectedModel, textureFiles]);

  function processFiles(files: FileList | File[]) {
    const entries = Array.from(files).map(toEntry);
    const smds = entries.filter(entry => entry.ext === "smd");
    const assets = entries.filter(entry => entry.ext !== "smd");

    if (smds.length > 0) {
      setSmdFiles(prev => mergeEntries(prev, smds));
      setSelectedId(current => current || smds[0].id);
    }

    if (assets.length > 0) {
      setAssetFiles(prev => mergeEntries(prev, assets));
    }
  }

  function clearLibrary() {
    setSmdFiles([]);
    setAssetFiles([]);
    setSelectedId("");
    setQuery("");
    setFilter("all");
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
      setFilter("all");
    } catch {
      alert("Não foi possível carregar o exemplo embutido.");
    }
  }

  return (
    <div className="app-shell studio-shell">
      <header className="topbar studio-header">
        <div className="brand-block">
          <span className="brand-mark">AT</span>
          <div>
            <h1>ALUCARD-TOOLS</h1>
            <p>Showcase profissional para arquivos SMD do PristonTale</p>
          </div>
        </div>

        <div className="top-actions">
          <label className="action-button primary">
            Abrir pasta do cliente
            <FolderInput
              type="file"
              webkitdirectory=""
              multiple
              onChange={event => {
                if (event.target.files) processFiles(event.target.files);
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
                if (event.target.files) processFiles(event.target.files);
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
          processFiles(event.dataTransfer.files);
        }}
      >
        <aside className="studio-left">
          <section className="stat-grid compact-stats">
            <div><strong>{smdFiles.length}</strong><span>modelos SMD</span></div>
            <div><strong>{textureFiles.length}</strong><span>texturas</span></div>
          </section>

          <section className="panel upload-guide">
            <div className="panel-title-row">
              <h2>Fluxo do cliente</h2>
              <span>3 passos</span>
            </div>
            <ol>
              <li>Enviar o <strong>.smd</strong> do item.</li>
              <li>Enviar junto <strong>.bmp/.tga/.dds</strong>.</li>
              <li>Conferir no Showcase e exportar PNG.</li>
            </ol>
          </section>

          <section className="panel library-panel">
            <div className="panel-title-row">
              <h2>Biblioteca SMD</h2>
              <span>{filteredModels.length}/{smdFiles.length}</span>
            </div>

            <input
              className="search-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar modelo, arma, escudo..."
            />

            <div className="filter-tabs studio-tabs">
              {FILTERS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? "active" : ""}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <small>{counts[item.id]}</small>
                </button>
              ))}
            </div>

            <div className="model-list studio-model-list">
              {filteredModels.length > 0 ? filteredModels.map(entry => {
                const active = selectedModel?.id === entry.id;
                const profile = getProfile(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`model-card studio-model-card ${active ? "active" : ""}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="model-card-head">
                      <span className="model-name">{entry.name}</span>
                      <span className="model-badge">{profile.badge}</span>
                    </span>
                    <span className="model-path">{entry.path}</span>
                    <span className="model-meta">{readableSize(entry.file.size)} · {profile.label}</span>
                  </button>
                );
              }) : (
                <div className="empty-small">
                  Nenhum .smd nesse filtro. Abra uma pasta que contenha o modelo 3D e suas texturas.
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="studio-viewer">
          {selectedModel ? (
            <SMDViewer
              key={selectedModel.id}
              smdFile={selectedModel.file}
              smdPath={selectedModel.path}
              extraFiles={viewerAssets}
            />
          ) : (
            <div className="drop-hero studio-hero">
              <div className="orb">3D</div>
              <h2>Visualize itens do PristonTale sem instalar ferramenta local</h2>
              <p>O cliente pode enviar uma pasta ou selecionar arquivos SMD com texturas. A prévia mostra o modelo em Showcase, com rotação, textura, eixo PT e exportação PNG.</p>
              <div className="hero-actions">
                <label className="action-button primary large">
                  Abrir pasta completa
                  <FolderInput
                    type="file"
                    webkitdirectory=""
                    multiple
                    onChange={event => {
                      if (event.target.files) processFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <label className="action-button large">
                  Abrir arquivos soltos
                  <input
                    type="file"
                    accept=".smd,.bmp,.tga,.dds,.png,.jpg,.jpeg"
                    multiple
                    onChange={event => {
                      if (event.target.files) processFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <button type="button" className="demo-link" onClick={loadDemo}>Carregar exemplo rápido</button>
            </div>
          )}
        </section>

        <aside className="studio-right">
          <section className="panel inspector-card">
            <div className="panel-title-row">
              <h2>Modelo selecionado</h2>
              <span>{selectedModel ? "ativo" : "vazio"}</span>
            </div>
            {selectedModel && selectedProfile ? (
              <div className="inspector-content">
                <strong className="inspector-title">{selectedModel.name}</strong>
                <p>{selectedModel.path}</p>
                <div className="kv-grid">
                  <span>Tipo</span><strong>{selectedProfile.label}</strong>
                  <span>Status</span><strong>{selectedProfile.badge}</strong>
                  <span>Tamanho</span><strong>{readableSize(selectedModel.file.size)}</strong>
                  <span>Textura provável</span><strong>{selectedTextureHint?.name ?? "ver no painel do viewer"}</strong>
                </div>
                <div className="recommendation-box">
                  <strong>Recomendação</strong>
                  <p>{selectedProfile.note}</p>
                </div>
              </div>
            ) : (
              <div className="empty-small">Nenhum modelo selecionado.</div>
            )}
          </section>

          <section className="panel usage-card">
            <div className="panel-title-row">
              <h2>Uso recomendado</h2>
              <span>PristonTale</span>
            </div>
            <div className="usage-list">
              <div><strong>Showcase</strong><span>Para arma, escudo, asa, elmo, máscara e item isolado.</span></div>
              <div><strong>Textura</strong><span>Deixe ligado para aproximar o visual dentro do jogo.</span></div>
              <div><strong>Eixo PT</strong><span>Use quando o modelo abrir deitado ou invertido.</span></div>
              <div><strong>Centralizar</strong><span>Corrige câmera e escala para print/catalogação.</span></div>
            </div>
          </section>

          <section className="panel texture-panel studio-assets">
            <div className="panel-title-row">
              <h2>Assets importados</h2>
              <span>{assetFiles.length}</span>
            </div>
            <div className="asset-list">
              {assetFiles.slice(0, 120).map(entry => (
                <div key={entry.id} className="asset-row">
                  <span>{entry.name}</span>
                  <small>{entry.ext || "file"}</small>
                </div>
              ))}
              {assetFiles.length > 120 && <div className="asset-more">+{assetFiles.length - 120} arquivos</div>}
              {assetFiles.length === 0 && <div className="empty-small">Texturas BMP/TGA/DDS/PNG aparecem aqui.</div>}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
