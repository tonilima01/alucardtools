import { itemTypeLabel, slotLabel } from "../core/itemClassifier";
import { readableSize } from "../core/nameRules";
import type { ItemPackage } from "../types/itemPackage";

interface Props {
  item: ItemPackage | null;
}

function StatusPill({ ok }: { ok: boolean }) {
  return <span className={`pill ${ok ? "ok" : "warn"}`}>{ok ? "com textura" : "incompleto"}</span>;
}

export function ItemPackagePanel({ item }: Props) {
  if (!item) {
    return (
      <aside className="right-panel">
        <section className="side-card empty-state-card">
          <h2>Pacote do item</h2>
          <p>Selecione um pacote na biblioteca para ver o SMD, texturas e arquivos relacionados.</p>
        </section>
        <section className="side-card howto-card">
          <h2>Fluxo correto</h2>
          <ol>
            <li>Abrir a pasta <b>tmABCD</b> ou pasta do item.</li>
            <li>Buscar por código: <b>itws</b>, <b>itwd</b>, <b>hair</b>, <b>shield</b>.</li>
            <li>Selecionar o pacote e exportar PNG.</li>
          </ol>
          <p className="privacy-note">SMD, BMP, TGA, DDS, PNG e JPG são lidos localmente no navegador. Nada é enviado ao servidor.</p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="right-panel">
      <section className="side-card selected-card">
        <div className="section-head">
          <h2>Modelo selecionado</h2>
          <StatusPill ok={item.textures.length > 0} />
        </div>
        <h3 className="selected-title">{item.displayName}</h3>
        <p className="muted path-line">{item.smd.path}</p>
        <div className="info-grid">
          <div><span>Tipo</span><strong>{itemTypeLabel(item.itemType)}</strong></div>
          <div><span>Slot</span><strong>{slotLabel(item.slot)}</strong></div>
          <div><span>Tamanho</span><strong>{readableSize(item.smd.size)}</strong></div>
          <div><span>Família</span><strong>{item.familyKey}</strong></div>
        </div>
      </section>

      <section className="side-card package-card">
        <div className="section-head"><h2>Arquivos que formam o item</h2><span>{1 + item.textures.length}</span></div>
        <div className="file-row main-file"><b>SMD</b><span>{item.smd.name}</span></div>
        {item.textures.length > 0 ? item.textures.map((match, idx) => (
          <div className="file-row" key={match.file.id}>
            <b>Textura {idx + 1}</b>
            <span>{match.file.name}</span>
            <small>{match.reason}</small>
          </div>
        )) : <div className="missing-box">Nenhuma textura encontrada automaticamente.</div>}
        {item.missingTextures.length > 0 && (
          <div className="missing-box">
            <b>Texturas citadas no SMD e faltando:</b>
            {item.missingTextures.slice(0, 8).map(t => <span key={t}>{t}</span>)}
          </div>
        )}
      </section>

      <section className="side-card related-card">
        <div className="section-head"><h2>Relacionados na pasta</h2><span>{item.relatedFiles.length}</span></div>
        <div className="related-list">
          {item.relatedFiles.slice(0, 18).map(f => (
            <div className="related-row" key={f.id}><span>{f.name}</span><small>{f.ext.toUpperCase()}</small></div>
          ))}
          {item.relatedFiles.length === 0 && <p className="muted">Nenhum arquivo relacionado encontrado.</p>}
        </div>
      </section>
    </aside>
  );
}
