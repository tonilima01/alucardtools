import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
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

interface EmbeddedCharacter {
  id: string;
  name: string;
  base: string;
  defaultModel?: string;
  files?: string[];
  smdFiles?: string[];
}

interface EmbeddedManifest {
  characters: EmbeddedCharacter[];
}

type ModelCategoryFilter = "all" | "showcase" | "equipment" | "character" | "part";
type ModelCategory = Exclude<ModelCategoryFilter, "all">;

interface ModelProfile {
  category: ModelCategory;
  label: string;
  badge: string;
  className: string;
  showcaseReady: boolean;
  recommendation: string;
}

const MODEL_FILTERS: Array<{ id: ModelCategoryFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "showcase", label: "Showcase OK" },
  { id: "equipment", label: "Equipamentos" },
  { id: "character", label: "Personagens" },
  { id: "part", label: "Partes/Costumes" },
];

function modelStem(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
}

function getModelProfile(entry: FileEntry): ModelProfile {
  const stem = modelStem(entry.name);

  const isBaseCharacter = /^(archer|atalanta|assasin|assassin|mago|mecanico|sacer|shaman|pikeman|lutador|fighter|kinght|knight)(1|2)?$/i.test(stem);
  const isHairOrMask = /(hair|mask|msk|cap|head|face|helmet|helm)/i.test(stem);
  const isWeaponOrShield = /(itwa|weapon|sword|axe|bow|arco|javelin|staff|wand|shield|shl|escudo|orb|claw|dagger)/i.test(stem);
  const isBackVisual = /(wing|back|costas|cape|manto|asa)/i.test(stem);
  const isCostumeOrBody = /(armor|armou?r|dress|robe|costume|lpk|xmas|dragon|swim|santa|hanbok|kimono|school|soldier|wedding|wc|traje|125|128|150|175|301|vip|inferno|predator|premo|arc|ata|mec|pik|pri|pr|fs|ks|ms|mg|sh)/i.test(stem);

  if (isBaseCharacter) {
    return {
      category: "character",
      label: "Personagem base",
      badge: "Base",
      className: "profile-character",
      showcaseReady: false,
      recommendation: "Use no modo Personagem real. Para Showcase puro, prefira arma, escudo, asa, máscara ou item isolado.",
    };
  }

  if (isWeaponOrShield || isBackVisual || isHairOrMask) {
    return {
      category: "equipment",
      label: isWeaponOrShield ? "Equipamento isolado" : "Acessório isolado",
      badge: "Showcase OK",
      className: "profile-showcase",
      showcaseReady: true,
      recommendation: "Bom para Showcase: centralizar, Textura ON, Auto giro e Exportar PNG.",
    };
  }

  if (isCostumeOrBody) {
    return {
      category: "part",
      label: "Parte/costume",
      badge: "Montagem",
      className: "profile-part",
      showcaseReady: false,
      recommendation: "Pode aparecer amassado no 3D bruto. Use como parte do personagem real ou evite no Showcase.",
    };
  }

  return {
    category: "showcase",
    label: "Modelo isolado",
    badge: "Showcase OK",
    className: "profile-showcase",
    showcaseReady: true,
    recommendation: "Modelo genérico: recomendado para Showcase se a textura carregar corretamente.",
  };
}

function fileId(file: File): string {
  const path = file.webkitRelativePath || file.name;
  return `${path}::${file.size}::${file.lastModified}`;
}

function fileExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function filePath(file: File): string {
  return file.webkitRelativePath || file.name;
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

function toEmbeddedEntry(file: File, path: string): FileEntry {
  return {
    id: `embedded::${path}::${file.size}`,
    file,
    path,
    name: file.name,
    ext: fileExt(file.name),
  };
}

const CHARACTER_NAME_RE = /(kinght|knight|fighter|lutador|pikeman|archer|atalanta|assasin|assassin|mecanico|mechanic|mechanician|mago|magician|sacer|priest|priestess|shaman)/i;
const CHARACTER_MANIFEST_URL = "/characters/characters.json";

function publicAssetUrl(folder: string, fileName: string): string {
  return `${folder}/${encodeURIComponent(fileName)}`;
}

function isLikelyCharacter(entry: FileEntry): boolean {
  const name = entry.name.replace(/\.[^.]+$/, "").toLowerCase();
  if (!CHARACTER_NAME_RE.test(name)) return false;
  return !/(hair|mask|cap|wing|shield|weapon|dragon|xmas|dress|armor-|armou?r|helmet|helm|axe|sword|bow|javelin|staff)/i.test(name);
}

function pickDefaultCharacter(entries: FileEntry[]): FileEntry | null {
  return entries.find(entry => /^(kinght|knight)\d*$/i.test(entry.name.replace(/\.[^.]+$/, "")))
    ?? entries.find(isLikelyCharacter)
    ?? null;
}

function pickEntryByName(entries: FileEntry[], fileName: string): FileEntry | null {
  return entries.find(entry => entry.name.toLowerCase() === fileName.toLowerCase()) ?? null;
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

export default function App() {
  const [smdFiles, setSmdFiles] = useState<FileEntry[]>([]);
  const [assetFiles, setAssetFiles] = useState<FileEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");
  const [embeddedCharacters, setEmbeddedCharacters] = useState<EmbeddedCharacter[]>([]);
  const [embeddedCharacterId, setEmbeddedCharacterId] = useState<string>("knight");
  const [embeddedLoading, setEmbeddedLoading] = useState(false);
  const [embeddedError, setEmbeddedError] = useState("");
  const [loadedPackId, setLoadedPackId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ModelCategoryFilter>("all");

  const selectedModel = smdFiles.find(entry => entry.id === selectedId) ?? smdFiles[0] ?? null;
  const characterModel = smdFiles.find(entry => entry.id === characterId) ?? null;
  const textureCount = assetFiles.filter(entry => isTextureExt(entry.ext)).length;
  const viewerAssets = useMemo(() => assetFiles.map(entry => entry.file), [assetFiles]);
  const selectedProfile = selectedModel ? getModelProfile(selectedModel) : null;

  const profileCounts = useMemo(() => {
    const counts: Record<ModelCategoryFilter, number> = { all: smdFiles.length, showcase: 0, equipment: 0, character: 0, part: 0 };
    for (const entry of smdFiles) {
      const profile = getModelProfile(entry);
      if (profile.category !== "showcase") counts[profile.category] += 1;
      if (profile.showcaseReady) counts.showcase += 1;
    }
    return counts;
  }, [smdFiles]);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return smdFiles.filter(entry => {
      const profile = getModelProfile(entry);
      const matchesQuery = !q || entry.path.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all"
        || (categoryFilter === "showcase" ? profile.showcaseReady : profile.category === categoryFilter);
      return matchesQuery && matchesCategory;
    });
  }, [query, smdFiles, categoryFilter]);

  const characterOptions = useMemo(() => {
    const likely = smdFiles.filter(isLikelyCharacter);
    return likely.length > 0 ? likely : smdFiles;
  }, [smdFiles]);

  useEffect(() => {
    if (!characterId && smdFiles.length > 0) {
      setCharacterId(pickDefaultCharacter(smdFiles)?.id ?? "");
    }
  }, [characterId, smdFiles]);

  useEffect(() => {
    fetch(CHARACTER_MANIFEST_URL)
      .then(async response => {
        if (!response.ok) throw new Error("characters.json não encontrado");
        const text = await response.text();
        const manifest = JSON.parse(text.replace(/^\uFEFF/, "")) as EmbeddedManifest;
        setEmbeddedCharacters(manifest.characters ?? []);
        if (manifest.characters?.[0]?.id) setEmbeddedCharacterId(manifest.characters[0].id);
      })
      .catch(error => {
        console.warn(error);
        setEmbeddedError("Pacote public/characters não encontrado nesta build.");
      });
  }, []);

  function processFiles(files: FileList | File[]) {
    const entries = Array.from(files).map(toEntry);
    const smds = entries.filter(entry => entry.ext === "smd");
    const assets = entries.filter(entry => entry.ext !== "smd");

    if (smds.length > 0) {
      setSmdFiles(prev => mergeEntries(prev, smds));
      const recommended = smds.find(entry => getModelProfile(entry).showcaseReady) ?? smds[0];
      setSelectedId(current => current || recommended.id);
    }

    if (assets.length > 0) {
      setAssetFiles(prev => mergeEntries(prev, assets));
    }
  }

  function clearLibrary() {
    setSmdFiles([]);
    setAssetFiles([]);
    setSelectedId("");
    setCharacterId("");
    setQuery("");
    setCategoryFilter("all");
    setLoadedPackId("");
  }

  async function loadDemo() {
    try {
      const smdUrl = "/itWA101.smd";
      const bmpUrl = "/itwa101.bmp";
      const [smdResponse, bmpResponse] = await Promise.all([fetch(smdUrl), fetch(bmpUrl)]);
      if (!smdResponse.ok || !bmpResponse.ok) throw new Error("Demo files not found");
      const smdBlob = await smdResponse.blob();
      const bmpBlob = await bmpResponse.blob();
      const smd = new File([smdBlob], "itWA101.smd", { type: "application/octet-stream" });
      const bmp = new File([bmpBlob], "itwa101.bmp", { type: "image/bmp" });
      const smdEntry = toEntry(smd);
      const bmpEntry = toEntry(bmp);
      setSmdFiles(prev => mergeEntries(prev, [smdEntry]));
      setAssetFiles(prev => mergeEntries(prev, [bmpEntry]));
      setSelectedId(smdEntry.id);
    } catch {
      alert("Não foi possível carregar o exemplo embutido.");
    }
  }

  async function loadEmbeddedCharacter(id = embeddedCharacterId) {
    const character = embeddedCharacters.find(item => item.id === id);
    if (!character) {
      alert("Personagem Vercel não encontrado no manifest.");
      return;
    }

    const files = character.files ?? [];
    if (files.length === 0) {
      alert(`O personagem ${character.name} não possui lista de arquivos no characters.json.`);
      return;
    }

    setEmbeddedLoading(true);
    setEmbeddedError("");

    try {
      const folder = `/characters/${character.id}`;
      const loaded = await Promise.all(files.map(async fileName => {
        const response = await fetch(publicAssetUrl(folder, fileName));
        if (!response.ok) throw new Error(`${character.name}: arquivo não encontrado: ${fileName}`);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: "application/octet-stream" });
        return toEmbeddedEntry(file, `characters/${character.id}/${fileName}`);
      }));

      const smds = loaded.filter(entry => entry.ext === "smd");
      const assets = loaded.filter(entry => entry.ext !== "smd");
      const base = pickEntryByName(smds, character.base) ?? pickDefaultCharacter(smds) ?? smds[0] ?? null;
      const defaultModel = character.defaultModel ? pickEntryByName(smds, character.defaultModel) : null;
      const showcaseModel = smds.find(entry => getModelProfile(entry).showcaseReady && entry.id !== base?.id) ?? null;
      const preview = showcaseModel ?? defaultModel ?? smds.find(entry => entry.id !== base?.id) ?? base;

      setSmdFiles(prev => mergeEntries(prev, smds));
      setAssetFiles(prev => mergeEntries(prev, assets));
      setCharacterId(base?.id ?? "");
      setSelectedId(preview?.id ?? base?.id ?? "");
      setLoadedPackId(character.id);
      setQuery("");
      setCategoryFilter("all");
    } catch (error) {
      console.error(error);
      setEmbeddedError((error as Error).message || "Falha ao carregar personagem Vercel.");
      alert(`Não foi possível carregar ${character.name}. Veja o console/log.`);
    } finally {
      setEmbeddedLoading(false);
    }
  }

  const modelList = filteredModels.map(entry => {
    const active = selectedModel?.id === entry.id;
    const profile = getModelProfile(entry);
    return (
      <button
        key={entry.id}
        type="button"
        className={`model-card ${profile.className} ${active ? "active" : ""}`}
        title={profile.recommendation}
        onClick={() => {
          setSelectedId(entry.id);
          if (profile.category === "character") setCharacterId(entry.id);
        }}
      >
        <span className="model-card-head">
          <span className="model-name">{entry.name}</span>
          <span className={`model-badge ${profile.className}`}>{profile.badge}</span>
        </span>
        <span className="model-path">{entry.path}</span>
        <span className="model-meta">{readableSize(entry.file.size)} · {profile.label}</span>
      </button>
    );
  });

  const loadedEmbeddedCharacter = embeddedCharacters.find(item => item.id === loadedPackId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">AT</span>
          <div>
            <h1>ALUCARD-TOOLS</h1>
            <p>SMD Studio técnico: modelos, texturas, diagnóstico e preview no personagem</p>
          </div>
        </div>

        <div className="top-actions">
          <label className="action-button primary">
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
          <label className="action-button">
            Abrir pasta
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
          <button type="button" className="action-button ghost" onClick={loadDemo}>Exemplo</button>
          <button
            type="button"
            className="action-button ghost"
            onClick={() => loadEmbeddedCharacter()}
            disabled={embeddedLoading || embeddedCharacters.length === 0}
          >
            {embeddedLoading ? "Carregando..." : "Personagem Vercel"}
          </button>
          <button type="button" className="action-button danger" onClick={clearLibrary} disabled={smdFiles.length === 0 && assetFiles.length === 0}>
            Limpar
          </button>
        </div>
      </header>

      <main
        className={`workspace ${dragging ? "dragging" : ""}`}
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
        <aside className="sidebar">
          <section className="stat-grid">
            <div>
              <strong>{smdFiles.length}</strong>
              <span>modelos</span>
            </div>
            <div>
              <strong>{textureCount}</strong>
              <span>texturas</span>
            </div>
          </section>

          <section className="panel embedded-panel">
            <div className="panel-title-row">
              <h2>Personagens Vercel</h2>
              <span>{embeddedCharacters.length}</span>
            </div>
            <div className="embedded-picker">
              <select
                value={embeddedCharacterId}
                onChange={event => setEmbeddedCharacterId(event.target.value)}
                disabled={embeddedCharacters.length === 0 || embeddedLoading}
              >
                {embeddedCharacters.length === 0 && <option value="">Nenhum pacote</option>}
                {embeddedCharacters.map(character => (
                  <option key={character.id} value={character.id}>{character.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => loadEmbeddedCharacter()} disabled={embeddedLoading || embeddedCharacters.length === 0}>
                {embeddedLoading ? "Carregando..." : "Carregar classe"}
              </button>
              <div className="character-hint">
                {loadedEmbeddedCharacter
                  ? <>Pacote carregado: <strong>{loadedEmbeddedCharacter.name}</strong></>
                  : embeddedError || "Carrega os modelos de public/characters direto da Vercel."}
              </div>
            </div>
          </section>

          <section className="panel character-panel">
            <div className="panel-title-row">
              <h2>Personagem real</h2>
              <span>{characterModel ? "ativo" : "sem base"}</span>
            </div>
            <div className="character-picker">
              <select
                value={characterId}
                onChange={event => setCharacterId(event.target.value)}
                disabled={smdFiles.length === 0}
              >
                <option value="">Sem personagem real</option>
                {characterOptions.map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
              <div className="character-hint">
                {characterModel
                  ? <>Selecionado: <strong>{characterModel.name}</strong></>
                  : "Selecione um SMD base real da classe carregada."}
              </div>
              <div className="character-actions">
                <button type="button" onClick={() => setCharacterId(pickDefaultCharacter(smdFiles)?.id ?? "")} disabled={smdFiles.length === 0}>Auto</button>
                <button type="button" onClick={() => setCharacterId("")} disabled={!characterId}>Limpar base</button>
              </div>
            </div>
          </section>

          {selectedModel && selectedProfile && (
            <section className={`panel compatibility-panel ${selectedProfile.className}`}>
              <div className="panel-title-row">
                <h2>Modo recomendado</h2>
                <span>{selectedProfile.badge}</span>
              </div>
              <div className="compatibility-body">
                <strong>{selectedProfile.label}</strong>
                <p>{selectedProfile.recommendation}</p>
                {selectedProfile.category === "character" && (
                  <button type="button" onClick={() => setCharacterId(selectedModel.id)}>Usar como personagem base</button>
                )}
                {selectedProfile.showcaseReady && (
                  <span className="compatibility-ok">Pronto para catálogo/showcase</span>
                )}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-title-row">
              <h2>Biblioteca SMD</h2>
              <span>{filteredModels.length}/{smdFiles.length}</span>
            </div>
            <div className="filter-tabs">
              {MODEL_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  className={categoryFilter === filter.id ? "active" : ""}
                  onClick={() => setCategoryFilter(filter.id)}
                >
                  {filter.label}
                  <small>{profileCounts[filter.id]}</small>
                </button>
              ))}
            </div>
            <input
              className="search-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar modelo..."
            />
            <div className="model-list">
              {modelList.length > 0 ? modelList : (
                <div className="empty-small">
                  Nenhum modelo neste filtro. Use "Todos" ou carregue uma pasta com itens/armas/escudos.
                </div>
              )}
            </div>
          </section>

          <section className="panel texture-panel">
            <div className="panel-title-row">
              <h2>Assets carregados</h2>
              <span>{assetFiles.length}</span>
            </div>
            <div className="asset-list">
              {assetFiles.slice(0, 60).map(entry => (
                <div key={entry.id} className="asset-row">
                  <span>{entry.name}</span>
                  <small>{entry.ext || "file"}</small>
                </div>
              ))}
              {assetFiles.length > 60 && <div className="asset-more">+{assetFiles.length - 60} arquivos</div>}
              {assetFiles.length === 0 && <div className="empty-small">BMP/TGA/DDS/PNG aparecem aqui.</div>}
            </div>
          </section>
        </aside>

        <section className="viewer-area">
          {selectedModel ? (
            <SMDViewer
              key={`${selectedModel.id}::${characterModel?.id ?? "no-character"}`}
              smdFile={selectedModel.file}
              smdPath={selectedModel.path}
              extraFiles={viewerAssets}
              characterFile={characterModel?.file ?? null}
              characterPath={characterModel?.path ?? ""}
            />
          ) : (
            <div className="drop-hero">
              <div className="orb">3D</div>
              <h2>ALUCARD-TOOLS · SMD Studio</h2>
              <p>Carregue personagens direto da Vercel ou abra seus .smd com texturas .bmp/.tga/.dds para gerar previews de loja/catálogo.</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="action-button primary large"
                  onClick={() => loadEmbeddedCharacter()}
                  disabled={embeddedLoading || embeddedCharacters.length === 0}
                >
                  {embeddedLoading ? "Carregando..." : "Carregar personagem Vercel"}
                </button>
                <label className="action-button large">
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
              </div>
              <button type="button" className="demo-link" onClick={loadDemo}>Carregar exemplo simples</button>
              {embeddedError && <div className="empty-small">{embeddedError}</div>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
