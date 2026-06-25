export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

export function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function justName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

export function folderOf(path: string): string {
  const p = path.replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : "";
}

export function normalizeName(name: string): string {
  return stripExt(justName(name))
    .toLowerCase()
    .replace(/[\s_\-()\[\]{}]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeLoose(name: string): string {
  return stripExt(justName(name))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function extractFamilyKey(name: string): string {
  const n = normalizeName(name);

  let m = n.match(/^(it[a-z]{1,4}\d{2,5})/);
  if (m) return m[1];

  m = n.match(/^([a-z]{1,8}\d{2,5})/);
  if (m) return m[1];

  m = n.match(/^(\d{2,4}[a-z]{0,8})/);
  if (m) return m[1];

  return n.slice(0, Math.min(n.length, 16));
}

export function isTextureExt(ext: string): boolean {
  return ["bmp", "png", "jpg", "jpeg", "tga", "dds"].includes(ext.toLowerCase());
}

export function isSmdExt(ext: string): boolean {
  return ext.toLowerCase() === "smd";
}

export function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
