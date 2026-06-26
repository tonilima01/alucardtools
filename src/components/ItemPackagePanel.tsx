import { classLabel } from "../core/classDetector";
import { itemTypeLabel, slotLabel } from "../core/itemClassifier";
import { readableSize } from "../core/nameRules";
import type { ItemPackage } from "../types/itemPackage";

interface Props {
  item: ItemPackage | null;
}

export function ItemPackagePanel({ item }: Props) {
  if (!item) {
    return (
      <aside className="right-panel">
        <section className="side-card empty-details">
          <h2>Montagem no personagem</h2>
          <p>Selecione um pacote de <b>Hair</b>, <b>Armor</b> ou <b>Traje</b>. O sistema vai mostrar o SMD principal, 1 a 4 texturas e a base de personagem usada.</p>
        </section>
      </aside>
    );
  }

  const status = item.baseCharacter
    ? item.textures.length > 0 ? "Pronto para montagem" : "Sem textura"
    : "Base não encontrada";

  return (
    <aside className="right-panel">
      <section className="side-card selected-card">
        <div className="section-head"><h2>Modelo selecionado</h2><span className={item.textures.length ? "pill ok" : "pill warn"}>{item.textures.length ? "com textura" : "sem textura"}</span></div>
        <h3>{item.displayName}</h3>
        <p className="muted-path">{item.smd.path}</p>
        <div className="detail-grid">
          <div><span>Categoria</span><b>{itemTypeLabel(item.itemType)}</b></div>
          <div><span>Slot</span><b>{slotLabel(item.slot)}</b></div>
          <div><span>Classe alvo</span><b>{item.className || classLabel(item.classId)}</b></div>
          <div><span>Status</span><b>{status}</b></div>
        </div>
      </section>

      <section className="side-card package-card">
        <div className="section-head"><h2>Pacote do item</h2><span>{1 + item.textures.length}</span></div>
        <FileRow label="SMD principal" name={item.smd.name} meta={readableSize(item.smd.size)} strong />
        {item.textures.slice(0, 4).map((tex, idx) => (
          <FileRow key={tex.file.id} label={`Textura ${idx + 1}`} name={tex.file.name} meta={tex.reason.toUpperCase()} />
        ))}
        {item.textures.length === 0 && <div className="empty-small">Nenhuma textura encontrada para este pacote.</div>}
        {item.missingTextures.length > 0 && (
          <div className="missing-box">
            <b>Texturas citadas mas ausentes</b>
            {item.missingTextures.slice(0, 6).map(t => <span key={t}>{t}</span>)}
          </div>
        )}
      </section>

      <section className="side-card package-card">
        <div className="section-head"><h2>Base usada na montagem</h2><span>{item.baseCharacter ? "OK" : "faltando"}</span></div>
        {item.baseCharacter ? (
          <>
            <FileRow label="Personagem base" name={item.baseCharacter.smd.name} meta={item.baseCharacter.className} strong />
            {item.baseCharacter.textures.slice(0, 4).map((tex, idx) => (
              <FileRow key={tex.file.id} label={`Base tex ${idx + 1}`} name={tex.file.name} meta={tex.reason.toUpperCase()} />
            ))}
          </>
        ) : (
          <p className="warning-text">Não achei o SMD base da classe <b>{item.className}</b> na pasta carregada. Abra a tmABCD completa ou adicione o SMD base da classe.</p>
        )}
      </section>

      <section className="side-card package-card related-card">
        <div className="section-head"><h2>Relacionados na pasta</h2><span>{item.relatedFiles.length}</span></div>
        {item.relatedFiles.slice(0, 14).map(f => <FileRow key={f.id} label={f.ext.toUpperCase()} name={f.name} meta={readableSize(f.size)} />)}
      </section>
    </aside>
  );
}

function FileRow({ label, name, meta, strong = false }: { label: string; name: string; meta: string; strong?: boolean }) {
  return (
    <div className={`file-row ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <b title={name}>{name}</b>
      <em>{meta}</em>
    </div>
  );
}
