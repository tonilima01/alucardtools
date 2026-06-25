import { itemTypeLabel } from "../core/itemClassifier";
import { readableSize } from "../core/nameRules";
import type { ItemPackage, ItemType } from "../types/itemPackage";

interface Props {
  packages: ItemPackage[];
  selected: ItemPackage | null;
  query: string;
  filter: ItemType | "todos" | "completo";
  onQueryChange: (value: string) => void;
  onFilterChange: (value: ItemType | "todos" | "completo") => void;
  onSelect: (item: ItemPackage) => void;
}

const FILTERS: { key: ItemType | "todos" | "completo"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "completo", label: "Com textura" },
  { key: "ataque", label: "Ataque" },
  { key: "defesa", label: "Defesa" },
  { key: "escudo", label: "Escudo" },
  { key: "hair", label: "Hair/Mask" },
  { key: "asa", label: "Asa" },
  { key: "skin", label: "Skin" },
  { key: "outros", label: "Outros" },
];

function matches(item: ItemPackage, q: string, filter: ItemType | "todos" | "completo"): boolean {
  if (filter === "completo" && item.textures.length === 0) return false;
  if (filter !== "todos" && filter !== "completo" && item.itemType !== filter) return false;
  if (!q.trim()) return true;
  const hay = [item.displayName, item.smd.path, item.familyKey, item.itemType, item.slot, ...item.textures.map(t => t.file.name)].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase().trim());
}

export function PackageList({ packages, selected, query, filter, onQueryChange, onFilterChange, onSelect }: Props) {
  const filtered = packages.filter(item => matches(item, query, filter));

  return (
    <section className="library-panel">
      <div className="panel-title-row">
        <h2>Biblioteca do cliente</h2>
        <span>{filtered.length}/{packages.length}</span>
      </div>
      <input className="search-input" value={query} onChange={e => onQueryChange(e.target.value)} placeholder="Buscar: itws, itwd, shield, hair..." />
      <div className="filter-grid">
        {FILTERS.map(f => {
          const count = packages.filter(item => f.key === "todos" ? true : f.key === "completo" ? item.textures.length > 0 : item.itemType === f.key).length;
          return <button key={f.key} className={`filter-chip ${filter === f.key ? "active" : ""}`} onClick={() => onFilterChange(f.key)}>{f.label}<b>{count}</b></button>;
        })}
      </div>
      <div className="model-list">
        {filtered.slice(0, 250).map(item => (
          <button key={item.id} className={`model-card ${selected?.id === item.id ? "active" : ""}`} onClick={() => onSelect(item)}>
            <div className="model-card-top"><span className="model-name">{item.displayName}</span><span className={`badge ${item.textures.length ? "ok" : "warn"}`}>{item.textures.length ? "OK" : "sem textura"}</span></div>
            <span className="model-path">{item.smd.path}</span>
            <span className="model-meta">{readableSize(item.smd.size)} · {itemTypeLabel(item.itemType)} · {item.textures.length}/4 texturas</span>
          </button>
        ))}
        {filtered.length > 250 && <div className="asset-more">Mostrando 250 de {filtered.length}. Use a busca para refinar.</div>}
        {filtered.length === 0 && <div className="empty-small">Nenhum pacote encontrado nesse filtro.</div>}
      </div>
    </section>
  );
}
