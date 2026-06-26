import { useMemo, useState } from "react";
import { buildItemPackages } from "../core/itemPackageResolver";
import { indexFileList, mergeIndexedFiles } from "../core/fileIndex";
import { isTextureExt } from "../core/nameRules";
import type { IndexedFile, ItemPackage, PackageStats } from "../types/itemPackage";

export function useClientLibrary() {
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [packages, setPackages] = useState<ItemPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stats: PackageStats = useMemo(() => {
    const smdCount = packages.length;
    const textureCount = files.filter(f => isTextureExt(f.ext)).length;
    const completeCount = packages.filter(p => p.textures.length > 0).length;
    return { smdCount, textureCount, completeCount, incompleteCount: packages.length - completeCount };
  }, [files, packages]);

  async function importFiles(fileList: FileList | File[], mode: "replace" | "append" = "append") {
    const incoming = indexFileList(fileList);
    const nextFiles = mode === "replace" ? incoming : mergeIndexedFiles(files, incoming);
    setFiles(nextFiles);
    setLoading(true);
    setProgress(0);
    setProgressText("Indexando pasta do cliente...");
    setError(null);

    try {
      const resolved = await buildItemPackages(nextFiles, {
        onProgress(done, total, label) {
          setProgress(total > 0 ? Math.round((done / total) * 100) : 0);
          setProgressText(label);
        },
      });
      setPackages(resolved);
      setProgress(100);
      setProgressText(`Biblioteca pronta: ${resolved.length} pacotes encontrados`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao montar biblioteca de itens.");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgressText("");
      }, 450);
    }
  }

  function clear() {
    setFiles([]);
    setPackages([]);
    setLoading(false);
    setProgressText("");
    setProgress(0);
    setError(null);
  }

  return { files, packages, stats, loading, progressText, progress, error, importFiles, clear };
}
