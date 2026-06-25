import { forwardRef, useMemo, useRef, useState } from "react";
import { PackageList } from "./components/PackageList";
import { SMDViewer } from "./components/SMDViewer";
import { ItemPackagePanel } from "./components/ItemPackagePanel";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { useClientLibrary } from "./hooks/useClientLibrary";
import type { ItemPackage, ItemType } from "./types/itemPackage";
import "./App.css";

interface FolderInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
}

const FolderInput = forwardRef<HTMLInputElement, FolderInputProps>(function FolderInput(props, ref) {
  return <input ref={ref} {...props} />;
});

export default function App() {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { packages, stats, loading, progressText, progress, error, importFiles, clear } = useClientLibrary();
  const [selected, setSelected] = useState<ItemPackage | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ItemType | "todos" | "completo">("todos");
  const [dragging, setDragging] = useState(false);

  const selectedStillExists = useMemo(() => selected && packages.some(p => p.id === selected.id), [packages, selected]);
  if (selected && !selectedStillExists && packages.length === 0) setSelected(null);

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      setSelected(null);
      importFiles(files, "replace");
    }
    e.target.value = "";
  }

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) importFiles(files, "append");
    e.target.value = "";
  }

  function handleClear() {
    clear();
    setSelected(null);
    setQuery("");
    setFilter("todos");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files, "append");
  }

  return (
    <div className={`app-shell ${dragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">AT</div>
          <div>
            <h1>ALUCARD-TOOLS</h1>
            <p>Item Package Studio para SMD do PristonTale · leitura local no navegador</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="action-button primary" onClick={() => folderInputRef.current?.click()}>Abrir tmABCD / pasta do cliente</button>
          <button className="action-button" onClick={() => fileInputRef.current?.click()}>Adicionar arquivos</button>
          <button className="action-button ghost" onClick={() => alert("Use uma pasta contendo .smd + BMP/TGA/DDS/PNG. O sistema monta pacotes automaticamente e mostra quais arquivos formam cada item.")}>Ajuda</button>
          <button className="action-button danger" onClick={handleClear}>Limpar</button>
        </div>
      </header>

      <FolderInput ref={folderInputRef} type="file" multiple webkitdirectory="true" onChange={handleFolderChange} />
      <input ref={fileInputRef} type="file" multiple accept=".smd,.bmp,.tga,.dds,.png,.jpg,.jpeg" onChange={handleFilesChange} />

      <main className="workspace">
        <aside className="left-panel">
          <div className="stat-grid">
            <div><strong>{stats.smdCount.toLocaleString("pt-BR")}</strong><span>modelos SMD</span></div>
            <div><strong>{stats.textureCount.toLocaleString("pt-BR")}</strong><span>texturas</span></div>
          </div>

          <section className="flow-card">
            <div className="section-head"><h2>Fluxo correto</h2><span>local</span></div>
            <ol>
              <li>Abrir a pasta <b>tmABCD</b> ou a pasta do item.</li>
              <li>Pesquisar por código: <b>itws</b>, <b>itwd</b>, <b>DA399</b>, <b>hair</b>.</li>
              <li>Selecionar pacote, ajustar posição e exportar PNG.</li>
            </ol>
            <p className="privacy-note">Nada é enviado ao servidor. Os arquivos ficam no PC do cliente.</p>
          </section>

          <PackageList packages={packages} selected={selected} query={query} filter={filter} onQueryChange={setQuery} onFilterChange={setFilter} onSelect={setSelected} />
        </aside>

        <section className="viewer-column">
          {packages.length === 0 ? (
            <div className="drop-hero">
              <div className="orb">3D</div>
              <h2>Abra a pasta do cliente</h2>
              <p>Selecione a <b>tmABCD</b> inteira ou uma pasta menor do item. O sistema cria pacotes com SMD + 1 a 4 texturas automaticamente.</p>
              <div className="hero-actions">
                <button className="action-button primary large" onClick={() => folderInputRef.current?.click()}>Abrir tmABCD</button>
                <button className="action-button large" onClick={() => fileInputRef.current?.click()}>Adicionar arquivos</button>
              </div>
            </div>
          ) : (
            <SMDViewer item={selected} />
          )}
        </section>

        <ItemPackagePanel item={selected} />
      </main>

      <LoadingOverlay show={loading} title="Indexando biblioteca do cliente" text={progressText} progress={progress} />
      {error && <div className="toast-error">{error}</div>}
    </div>
  );
}
