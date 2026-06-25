import type { IndexedFile } from "../types/itemPackage";
import { folderOf, getExt } from "./nameRules";

export function fileId(file: File, path: string): string {
  return `${path}::${file.size}::${file.lastModified}`;
}

export function filePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function toIndexedFile(file: File): IndexedFile {
  const path = filePath(file).replace(/\\/g, "/");
  return {
    id: fileId(file, path),
    path,
    name: file.name,
    ext: getExt(file.name),
    file,
    size: file.size,
    folder: folderOf(path),
  };
}

export function mergeIndexedFiles(prev: IndexedFile[], incoming: IndexedFile[]): IndexedFile[] {
  const map = new Map<string, IndexedFile>();
  for (const f of prev) map.set(f.id, f);
  for (const f of incoming) map.set(f.id, f);
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export function indexFileList(list: FileList | File[]): IndexedFile[] {
  return Array.from(list).map(toIndexedFile).sort((a, b) => a.path.localeCompare(b.path));
}
