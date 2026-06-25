import type { IndexedFile, ItemPackage, TextureMatch } from "../types/itemPackage";
import { classifyItemType, classifySlot } from "./itemClassifier";
import { extractFamilyKey, isSmdExt, isTextureExt, normalizeLoose, normalizeName, stripExt } from "./nameRules";
import { parseSmdTextureRefs } from "./smdTextureRefs";

interface BuildOptions {
  onProgress?: (done: number, total: number, label: string) => void;
}

function addUniqueTexture(list: TextureMatch[], file: IndexedFile, reason: TextureMatch["reason"]): void {
  if (!list.some(x => x.file.id === file.id)) list.push({ file, reason });
}

function sameBase(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

function compatibleNameWithoutExt(texture: IndexedFile, expectedTextureName: string): boolean {
  return normalizeLoose(texture.name) === normalizeLoose(expectedTextureName);
}

function belongsToFamily(smdName: string, texName: string): boolean {
  const smdKey = extractFamilyKey(smdName);
  const texKey = extractFamilyKey(texName);
  const texNorm = normalizeName(texName);
  return smdKey === texKey || texNorm.startsWith(smdKey) || texNorm.includes(smdKey);
}

function relatedByFolderOrFamily(smd: IndexedFile, files: IndexedFile[], familyKey: string): IndexedFile[] {
  return files
    .filter(f => f.id !== smd.id)
    .filter(f => f.folder === smd.folder || normalizeName(f.name).includes(familyKey) || belongsToFamily(smd.name, f.name))
    .slice(0, 24);
}

function packageScore(pkg: ItemPackage): number {
  let score = 0;
  if (pkg.isComplete) score += 50;
  score += Math.min(pkg.textures.length, 4) * 10;
  if (pkg.itemType === "ataque" || pkg.itemType === "escudo" || pkg.itemType === "asa" || pkg.itemType === "hair") score += 25;
  if (pkg.itemType === "personagem") score -= 50;
  return score;
}

export async function buildItemPackages(files: IndexedFile[], options: BuildOptions = {}): Promise<ItemPackage[]> {
  const smdFiles = files.filter(f => isSmdExt(f.ext));
  const textureFiles = files.filter(f => isTextureExt(f.ext));
  const allByLowerName = new Map<string, IndexedFile[]>();

  for (const f of textureFiles) {
    const key = f.name.toLowerCase();
    const arr = allByLowerName.get(key) || [];
    arr.push(f);
    allByLowerName.set(key, arr);
  }

  const packages: ItemPackage[] = [];

  for (let i = 0; i < smdFiles.length; i++) {
    const smd = smdFiles[i];
    options.onProgress?.(i + 1, smdFiles.length, `Resolvendo pacote ${smd.name}`);

    let expectedTextures: string[] = [];
    try {
      expectedTextures = await parseSmdTextureRefs(smd.file);
    } catch {
      expectedTextures = [];
    }

    const matched: TextureMatch[] = [];
    const missing: string[] = [];

    for (const ref of expectedTextures) {
      const exact = allByLowerName.get(ref.toLowerCase());
      if (exact?.length) {
        for (const tex of exact) addUniqueTexture(matched, tex, "smd-ref");
        continue;
      }

      const withoutExt = stripExt(ref);
      const alt = textureFiles.filter(tex => compatibleNameWithoutExt(tex, withoutExt));
      if (alt.length) {
        for (const tex of alt) addUniqueTexture(matched, tex, "smd-ref");
      } else {
        missing.push(ref);
      }
    }

    if (matched.length === 0) {
      for (const tex of textureFiles) {
        if (sameBase(smd.name, tex.name)) addUniqueTexture(matched, tex, "same-base");
      }
    }

    if (matched.length === 0) {
      for (const tex of textureFiles) {
        if (belongsToFamily(smd.name, tex.name)) addUniqueTexture(matched, tex, "family");
      }
    }

    const familyKey = extractFamilyKey(smd.name);
    const relatedFiles = relatedByFolderOrFamily(smd, files, familyKey);
    const itemType = classifyItemType(smd.name);
    const slot = classifySlot(smd.name);

    const pkg: ItemPackage = {
      id: `${smd.path}::${smd.size}`,
      displayName: smd.name,
      smd,
      textures: matched.slice(0, 4),
      missingTextures: missing,
      expectedTextures,
      relatedFiles,
      familyKey,
      itemType,
      slot,
      isComplete: matched.length > 0 && missing.length === 0,
      sourceFolder: smd.folder,
      score: 0,
    };
    pkg.score = packageScore(pkg);
    packages.push(pkg);
  }

  return packages.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
}
