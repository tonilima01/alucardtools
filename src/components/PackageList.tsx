import { itemTypeLabel } from "../core/itemClassifier";
import { readableSize } from "../core/nameRules";
import type { ItemPackage, ItemType } from "../types/itemPackage";

interface Props {
  packages: ItemPackage[];
  selected: ItemPackage | null;
  query: string;
  filter: ItemType | "todos" | "completo" | "sem-base";
  onQueryChange: (value: string) => void;
  onFilterChange: (value: ItemType | "todos" | "completo" | "sem-base") => void;
  onSelect: (item: ItemPackage) => void;
}

const FILTERS: { key: ItemType | "todos" | "completo" | "sem-base"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "completo", label: "Com textura" },
  { key: "hair", label: "Hair" },
  { key: "armor", label: "Armor" },
  { key: "costume", label: "Trajes" },
  { key: "sem-base", label: "Sem base" },
];

function matches(item: ItemPackage, q: string, filter: ItemType | "todos" | "completo" | "sem-base"): boolean {
  if (filter === "completo" && item.textures.length === 0) return false;
  if (filter === "sem-base" && item.baseCharacter) return false;
  if (filter !== "todos" && filter !== "completo" && filter !== "sem-base" && item.itemType !== filter) return false;
  if (!q.trim()) return true;
  const hay = [
    item.displayName,
    item.smd.path,
    item.familyKey,
    item.itemType,
    item.slot,
    item.className,
    item.classId,
    item.baseCharacter?.smd.name ?? "",
    ...item.textures.map(t => t.file.name),
  ].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase().trim());
}

function filterCount(packages: ItemPackage[], key: ItemType | "todos" | "completo" | "sem-base"): number {
  if (key === "todos") return packages.length;
  if (key === "completo") return packages.filter(p => p.textures.length > 0).length;
  if (key === "sem-base") return packages.filter(p => !p.baseCharacter).length;
  return packages.filter(p => p.itemType === key).length;
}

export function PackageList({ packages, selected, query, filter, onQueryChange, onFilterChange, onSelect }: Props) {
  const filtered = packages.filter(item => matches(item, query, filter));

  return (
    <section className="library-panel">
      <div className="panel-title-row">
        <h2>Hair / Armor / Trajes</h2>
        <span>{filtered.length}/{packages.length}</span>
      </div>
      <input className="search-input" value={query} onChange={e => onQueryChange(e.target.value)} placeholder="Buscar: hair, armor, traje, FS, KS, ATA..." />
      <div className="filter-grid three-only">
        {FILTERS.map(f => (
          <button key={f.key} className={`filter-chip ${filter === f.key ? "active" : ""}`} onClick={() => onFilterChange(f.key)}>
            {f.label}<b>{filterCount(packages, f.key)}</b>
          </button>
        ))}
      </div>
      <div className="model-list">
        {filtered.slice(0, 250).map(item => (
          <button key={item.id} className={`model-card ${selected?.id === item.id ? "active" : ""}`} onClick={() => onSelect(item)}>
            <div className="model-card-top">
              <span className="model-name">{item.displayName}</span>
              <span className={`badge ${item.textures.length ? "ok" : "warn"}`}>{item.textures.length ? "OK" : "sem tex"}</span>
            </div>
            <span className="model-path">{item.smd.path}</span>
            <span className="model-meta">
              {readableSize(item.smd.size)} · {itemTypeLabel(item.itemType)} · {item.className} · {item.textures.length}/4 texturas
            </span>
            <span className={`base-mini ${item.baseCharacter ? "ok" : "warn"}`}>
              {item.baseCharacter ? `Base: ${item.baseCharacter.smd.name}` : "Base não encontrada"}
            </span>
          </button>
        ))}
        {filtered.length > 250 && <div className="asset-more">Mostrando 250 de {filtered.length}. Use a busca para refinar.</div>}
        {filtered.length === 0 && <div className="empty-small">Nenhum Hair, Armor ou Traje encontrado com esses filtros.</div>}
      </div>
    </section>
  );
}
