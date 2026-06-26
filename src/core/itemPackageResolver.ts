import type { CharacterBaseCandidate, CharacterClassId, IndexedFile, ItemPackage, TextureMatch } from "../types/itemPackage";
import { findBaseForClass, resolveBaseCharacters } from "./baseCharacterResolver";
import { detectClassFromName } from "./classDetector";
import { classifyItemType, classifySlot, isSupportedVisualType } from "./itemClassifier";
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
  if (pkg.itemType === "armor" || pkg.itemType === "costume" || pkg.itemType === "hair") score += 40;
  if (pkg.baseCharacter) score += 25;
  if (pkg.classId !== "unknown") score += 8;
  return score;
}

function detectClassWithFallback(smd: IndexedFile, expectedTextures: string[], textures: TextureMatch[]): CharacterClassId {
  let classId = detectClassFromName(smd.name);
  if (classId !== "unknown") return classId;

  for (const tex of textures) {
    classId = detectClassFromName(tex.file.name);
    if (classId !== "unknown") return classId;
  }

  for (const ref of expectedTextures) {
    classId = detectClassFromName(ref);
    if (classId !== "unknown") return classId;
  }

  return "unknown";
}

export async function buildItemPackages(files: IndexedFile[], options: BuildOptions = {}): Promise<ItemPackage[]> {
  const smdFiles = files.filter(f => isSmdExt(f.ext));
  const textureFiles = files.filter(f => isTextureExt(f.ext));
  const baseCharacters: CharacterBaseCandidate[] = resolveBaseCharacters(files);
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

    const itemType = classifyItemType(smd.name);
    if (!isSupportedVisualType(itemType)) continue;

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
    const slot = classifySlot(smd.name);
    const classId = detectClassWithFallback(smd, expectedTextures, matched);
    const baseCharacter = findBaseForClass(classId, baseCharacters);

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
      classId,
      className: baseCharacter?.className ?? (classId === "unknown" ? "Não detectada" : classId.toUpperCase()),
      baseCharacter,
      isComplete: matched.length > 0 && missing.length === 0,
      sourceFolder: smd.folder,
      score: 0,
    };
    pkg.score = packageScore(pkg);
    packages.push(pkg);
  }

  return packages.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
}
