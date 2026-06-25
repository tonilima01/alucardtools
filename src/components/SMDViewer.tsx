import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { parseSmd } from "../lib/parseSmd";
import { textureFromFile } from "../lib/decryptTexture";

interface Props {
  smdFile: File;
  smdPath: string;
  extraFiles: File[];
  characterFile?: File | null;
  characterPath?: string;
}

interface ViewOptions {
  textured: boolean;
  wireframe: boolean;
  grid: boolean;
  axes: boolean;
  autoRotate: boolean;
  darkBackground: boolean;
  characterPreview: boolean;
  ptAxisFix: boolean;
  showcase: boolean;
}

type EquipSlot = "free" | "weapon" | "shield" | "helmet" | "armor" | "back";
type CharacterClass = "Knight" | "Fighter" | "Pikeman" | "Archer" | "Atalanta" | "Mechanician" | "Magician" | "Priestess";

interface EquipTransform {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
  autoFit: boolean;
}

interface ViewerInfo {
  modelName: string;
  modelPath: string;
  modelSize: string;
  triangles: number;
  vertices: number;
  expectedTexture: string;
  matchedTexture: string;
  textureStatus: "loaded" | "missing" | "none" | "error";
  objectCount: number;
  bounds: string;
  assetCount: number;
  previewLabel: string;
  characterName: string;
  characterTexture: string;
}

interface BuiltSmdModel {
  group: any;
  size: any;
  maxDim: number;
  textureName: string;
  textureNames: string[];
  expectedTexture: string;
  matchedTexture: File | null;
  textureStatus: ViewerInfo["textureStatus"];
  objectCount: number;
  triangles: number;
  vertices: number;
  bounds: string;
  errors: string[];
}

const DEFAULT_EQUIP: Record<EquipSlot, EquipTransform> = {
  free:   { offsetX: 0,    offsetY: 0,    offsetZ: 0,    rotationX: 0,   rotationY: 0,   rotationZ: 0,   scale: 1,    autoFit: false },
  weapon: { offsetX: -0.2, offsetY: -0.15, offsetZ: 0.1,  rotationX: -12, rotationY: 12,  rotationZ: -28, scale: 1,    autoFit: true },
  shield: { offsetX: 0.2,  offsetY: -0.15, offsetZ: 0.2,  rotationX: 0,   rotationY: -18, rotationZ: 8,   scale: 1,    autoFit: true },
  helmet: { offsetX: 0,    offsetY: 0.15,  offsetZ: 0,    rotationX: 0,   rotationY: 0,   rotationZ: 0,   scale: 0.9,  autoFit: true },
  armor:  { offsetX: 0,    offsetY: 0,     offsetZ: 0,    rotationX: 0,   rotationY: 0,   rotationZ: 0,   scale: 1.05, autoFit: true },
  back:   { offsetX: 0,    offsetY: 0.1,   offsetZ: -0.4, rotationX: 0,   rotationY: 180, rotationZ: 0,   scale: 1,    autoFit: true },
};

const SLOT_LABELS: Record<EquipSlot, string> = {
  free: "Modelo livre",
  weapon: "Arma / mão direita",
  shield: "Escudo / mão esquerda",
  helmet: "Elmo / cabeça",
  armor: "Armadura / corpo",
  back: "Costas / visual",
};

const REAL_CHARACTER_HEIGHT = 8.6;

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function baseName(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
}

function justFileName(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? name.toLowerCase();
}

function textureKey(value: string): string {
  return baseName(value).replace(/[^a-z0-9]/g, "");
}

function isSameFile(a: File | null | undefined, b: File | null | undefined): boolean {
  if (!a || !b) return false;
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function isTextureFile(file: File): boolean {
  return /\.(bmp|tga|png|jpg|jpeg|dds)$/i.test(file.name);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

function findTextureFile(candidates: string[], smdFile: File, extraFiles: File[]): File | null {
  const textures = extraFiles.filter(isTextureFile);
  const smdBase = baseName(smdFile.name);
  const smdKey = textureKey(smdFile.name);
  const normalizedCandidates = uniqueStrings(candidates);

  if (textures.length === 1 && normalizedCandidates.length <= 1) {
    return textures[0];
  }

  for (const candidate of normalizedCandidates) {
    const expectedFile = justFileName(candidate);
    const expectedBase = baseName(candidate);
    const expectedKey = textureKey(candidate);

    const exact = textures.find(file => justFileName(file.name) === expectedFile);
    if (exact) return exact;

    const sameBase = textures.find(file => baseName(file.name) === expectedBase && expectedBase.length > 0);
    if (sameBase) return sameBase;

    const normalized = textures.find(file => {
      const key = textureKey(file.name);
      return key === expectedKey || (expectedKey.length >= 4 && (key.includes(expectedKey) || expectedKey.includes(key)));
    });
    if (normalized) return normalized;
  }

  return textures.find(file => baseName(file.name) === smdBase)
    ?? textures.find(file => textureKey(file.name) === smdKey)
    ?? textures.find(file => {
      const key = textureKey(file.name);
      return smdKey.length >= 4 && (key.includes(smdKey) || smdKey.includes(key));
    })
    ?? null;
}

function formatBounds(x: number, y: number, z: number): string {
  return `${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)}`;
}

function degToRad(value: number): number {
  return value * Math.PI / 180;
}

function getAnchor(slot: EquipSlot) {
  switch (slot) {
    case "weapon": return { x: -2.35, y: 5.45, z: 0.35 };
    case "shield": return { x: 2.35, y: 5.3, z: 0.45 };
    case "helmet": return { x: 0, y: 8.8, z: 0 };
    case "armor": return { x: 0, y: 4.55, z: 0 };
    case "back": return { x: 0, y: 5.4, z: -1.0 };
    default: return { x: 0, y: 0, z: 0 };
  }
}

function guessSlotFromName(fileName: string): EquipSlot {
  const name = fileName.toLowerCase();
  if (/(armor|armou?r|kina|kinght|knight|atalanta|archer|assasin|pikeman|fighter|mecanico|mago|sacer|shaman)/i.test(name)) return "armor";
  if (/(shield|shl|escudo)/i.test(name)) return "shield";
  if (/(helmet|helm|hair|mask|cap|hknight|head)/i.test(name)) return "helmet";
  if (/(wing|back|costas)/i.test(name)) return "back";
  if (/(itwa|sword|axe|bow|javelin|staff|weapon|arma)/i.test(name)) return "weapon";
  return "free";
}

function getFitSize(slot: EquipSlot): number {
  switch (slot) {
    case "weapon": return 5.8;
    case "shield": return 3.4;
    case "helmet": return 1.55;
    case "armor": return 4.1;
    case "back": return 5.2;
    default: return 1;
  }
}

function applyPremiumModelFlags(group: any) {
  group.traverse((obj: any) => {
    if (obj?.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if (mat) {
            mat.needsUpdate = true;
          }
        }
      }
    }
  });
}

function createShowcaseFloor() {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(14, 96),
    new THREE.MeshBasicMaterial({
      color: 0x10162b,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.015;
  group.add(shadow);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.9, 0.018, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x7d8cff, transparent: true, opacity: 0.42 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.018;
  group.add(ring);

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(2.7, 0.012, 8, 140),
    new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.28 }),
  );
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.021;
  group.add(inner);

  return group;
}

function buildPresetJson(smdFile: File, equipSlot: EquipSlot, equip: EquipTransform, characterClass: CharacterClass, characterFile?: File | null): string {
  return JSON.stringify({
    tool: "ALUCARD-TOOLS",
    model: smdFile.name,
    realCharacter: characterFile?.name ?? "none",
    characterClass,
    slot: equipSlot,
    anchor: SLOT_LABELS[equipSlot],
    offset: { x: equip.offsetX, y: equip.offsetY, z: equip.offsetZ },
    rotation: { x: equip.rotationX, y: equip.rotationY, z: equip.rotationZ },
    scale: equip.scale,
    autoFit: equip.autoFit,
  }, null, 2);
}

async function buildSmdModel(file: File, extraFiles: File[], textured: boolean, wireframe: boolean, fallbackColor: number, onProgress?: (progress: number, detail: string) => void): Promise<BuiltSmdModel> {
  const errors: string[] = [];
  onProgress?.(12, "Lendo arquivo SMD");
  const buffer = await file.arrayBuffer();
  onProgress?.(22, "Interpretando malha SMD");
  const meshData = parseSmd(buffer);

  onProgress?.(42, "Montando geometria 3D");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(meshData.positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(meshData.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const textureNames = uniqueStrings([meshData.textureName, ...meshData.textureNames]);
  const expectedTexture = textureNames[0] ?? "";
  onProgress?.(58, "Localizando texturas");
  const matchedTexture = findTextureFile(textureNames, file, extraFiles);
  let textureStatus: ViewerInfo["textureStatus"] = textureNames.length > 0 ? "missing" : "none";
  let textureMap: any = null;

  if (matchedTexture) {
    try {
      onProgress?.(72, `Carregando textura ${matchedTexture.name}`);
      textureMap = await textureFromFile(matchedTexture);
      textureMap.flipY = false;
      textureMap.colorSpace = THREE.SRGBColorSpace;
      textureMap.needsUpdate = true;
      textureStatus = "loaded";
    } catch (error) {
      errors.push(`Erro ao carregar textura ${matchedTexture.name}: ${(error as Error).message || String(error)}`);
      textureStatus = "error";
    }
  } else if (textureNames.length > 0) {
    errors.push(`Textura não encontrada: ${textureNames.slice(0, 4).join(" | ")}`);
  }

  onProgress?.(86, "Aplicando material e luz");
  const material = new THREE.MeshStandardMaterial({
    color: textured && textureMap ? 0xffffff : fallbackColor,
    map: textured ? textureMap : null,
    roughness: 0.62,
    metalness: 0.08,
    wireframe,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const rawBox = geometry.boundingBox;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  if (rawBox) {
    rawBox.getCenter(center);
    rawBox.getSize(size);
  }

  mesh.position.sub(center);
  mesh.position.y += size.y / 2;

  const group = new THREE.Group();
  group.name = file.name;
  group.add(mesh);

  return {
    group,
    size,
    maxDim: Math.max(size.x, size.y, size.z, 1),
    textureName: expectedTexture,
    textureNames,
    expectedTexture,
    matchedTexture,
    textureStatus,
    objectCount: meshData.objectCount,
    triangles: meshData.indices.length / 3,
    vertices: meshData.positions.length / 3,
    bounds: formatBounds(size.x, size.y, size.z),
    errors,
  };
}


export function SMDViewer({ smdFile, smdPath, extraFiles, characterFile = null, characterPath = "" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const activeModelRef = useRef<THREE.Object3D | null>(null);
  const [info, setInfo] = useState<ViewerInfo | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedPreset, setCopiedPreset] = useState(false);
  const [characterClass] = useState<CharacterClass>("Knight");
  const [equipSlot, setEquipSlot] = useState<EquipSlot>("free");
  const [equip, setEquip] = useState<EquipTransform>(DEFAULT_EQUIP.free);
  const [showTransformPanel, setShowTransformPanel] = useState(true);
  const [options, setOptions] = useState<ViewOptions>({
    textured: true,
    wireframe: false,
    grid: false,
    axes: false,
    autoRotate: false,
    darkBackground: true,
    characterPreview: false,
    ptAxisFix: true,
    showcase: true,
  });

  const [loading, setLoading] = useState({
    active: true,
    progress: 8,
    title: "Carregando modelo 3D",
    detail: smdFile.name,
  });

  function applyManualObjectTransform(object: THREE.Object3D | null, transform: EquipTransform) {
    if (!object) return;
    object.position.set(transform.offsetX, transform.offsetY, transform.offsetZ);
    object.rotation.set(degToRad(transform.rotationX), degToRad(transform.rotationY), degToRad(transform.rotationZ));
    object.scale.setScalar(Math.max(0.01, transform.scale));
  }

  useEffect(() => {
    applyManualObjectTransform(activeModelRef.current, equip);
  }, [equip]);

  useEffect(() => {
    // Cada novo modelo precisa iniciar parado e sem preset torto.
    // O usuário ajusta posição/rotação livremente no painel "Ajuste manual".
    setEquipSlot("free");
    setEquip(DEFAULT_EQUIP.free);
    setOptions(prev => ({ ...prev, autoRotate: false }));
    setCopiedPreset(false);
  }, [smdFile]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    const host: HTMLDivElement = mountEl;

    setErrors([]);
    setInfo(null);
    setLoading({ active: true, progress: 6, title: "Carregando modelo 3D", detail: smdFile.name });
    resetViewRef.current = null;
    activeModelRef.current = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.showcase ? 0x060814 : (options.darkBackground ? 0x070914 : 0x232a3a));

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const camera = new THREE.PerspectiveCamera(options.showcase ? 35 : 42, width / height, 0.01, 50000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = options.showcase ? 1.18 : 1.0;
    renderer.shadowMap.enabled = options.showcase;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.6;
    controls.maxDistance = 9000;
    controls.autoRotate = false;

    scene.add(new THREE.HemisphereLight(0xdbe6ff, 0x202030, options.showcase ? 1.8 : 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, options.showcase ? 2.35 : 1.65);
    keyLight.position.set(9, 13, 7);
    keyLight.castShadow = options.showcase;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 120;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x85a0ff, options.showcase ? 1.12 : 0.35);
    fillLight.position.set(-8, 6, 6);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffb17a, options.showcase ? 1.16 : 0.75);
    rimLight.position.set(-10, 7, -8);
    scene.add(rimLight);
    if (options.showcase) {
      const topLight = new THREE.PointLight(0x8f7cff, 2.1, 42);
      topLight.position.set(0, 9, 7);
      scene.add(topLight);
      scene.add(createShowcaseFloor());
    }

    if (options.grid && !options.showcase) {
      const grid = new THREE.GridHelper(options.characterPreview ? 18 : 80, options.characterPreview ? 18 : 40, 0x465075, 0x20263d);
      scene.add(grid);
    }
    if (options.axes && !options.showcase) {
      const axes = new THREE.AxesHelper(options.characterPreview ? 4 : 8);
      scene.add(axes);
    }

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    let disposed = false;
    let animationId = 0;
    let loadingTimer = 0;
    let rotatingGroup: any = null;

    function updateLoading(progress: number, detail: string) {
      if (disposed) return;
      setLoading({ active: true, progress: Math.max(3, Math.min(96, progress)), title: "Carregando modelo 3D", detail });
    }

    function finishLoading(detail = "Pronto") {
      if (disposed) return;
      setLoading({ active: true, progress: 100, title: "Carregando modelo 3D", detail });
      loadingTimer = window.setTimeout(() => {
        if (!disposed) setLoading(prev => ({ ...prev, active: false }));
      }, 260);
    }

    function setCameraForSize(maxDim: number, targetY: number) {
      const safeDim = Math.max(maxDim, 1);
      const fov = camera.fov * (Math.PI / 180);
      const distance = Math.abs(safeDim / Math.sin(fov / 2)) * (options.showcase ? 0.62 : 0.82);
      camera.near = Math.max(0.01, distance / 2000);
      camera.far = Math.max(5000, distance * 40);
      if (options.showcase) {
        camera.position.set(0, targetY + distance * 0.16, distance * 0.92);
      } else {
        camera.position.set(distance * 0.72, targetY + distance * 0.22, distance * 0.84);
      }
      camera.updateProjectionMatrix();
      controls.target.set(0, targetY, 0);
      controls.update();
    }

    async function loadScene() {
      const localErrors: string[] = [];
      const effectiveCharacterPreview = false;
      const skipEquipment = effectiveCharacterPreview && isSameFile(smdFile, characterFile);
      let characterName = characterFile ? characterFile.name : "Sem personagem real";
      let characterTexture = characterFile ? "aguardando leitura" : "Sem base real";

      if (effectiveCharacterPreview) {
        if (characterFile) {
          try {
            const character = await buildSmdModel(characterFile, extraFiles, options.textured, false, 0x9aa8ff, updateLoading);
            if (disposed) return;
            character.group.name = `Personagem real: ${characterFile.name}`;
            character.group.scale.setScalar(REAL_CHARACTER_HEIGHT / Math.max(character.size.y, 1));
            rootGroup.add(character.group);
            characterName = characterFile.name;
            characterTexture = character.textureStatus === "loaded"
              ? character.matchedTexture?.name ?? "OK"
              : character.textureName || "sem textura";
            localErrors.push(...character.errors.map(error => `Personagem: ${error}`));
          } catch (error) {
            localErrors.push(`Erro ao ler personagem real ${characterFile.name}: ${(error as Error).message}`);
            characterName = "Falha ao ler personagem real";
            characterTexture = "Sem fallback artificial";
          }
        }
      }

      let item: BuiltSmdModel | null = null;
      if (!skipEquipment) {
        try {
          item = await buildSmdModel(smdFile, extraFiles, options.textured, options.wireframe, 0xaab6ff, updateLoading);
        } catch (error) {
          const message = (error as Error).message || String(error);
          setErrors(prev => [...prev, ...localErrors, `Erro ao ler SMD: ${message}`]);
          setLoading({ active: false, progress: 0, title: "Falha ao carregar modelo", detail: message });
          return;
        }
      } else {
        try {
          item = await buildSmdModel(smdFile, extraFiles, options.textured, options.wireframe, 0xaab6ff, updateLoading);
        } catch {
          item = null;
        }
      }

      if (disposed) return;

      if (options.ptAxisFix) {
        rootGroup.rotation.x = -Math.PI / 2;
      }

      if (item && !skipEquipment) {
        // Showcase trabalha com o objeto livre, sem rotação automática e sem preset escondido.
        // O ajuste abaixo é atualizado em tempo real pelo painel "Ajuste manual" sem recarregar o SMD.
        applyManualObjectTransform(item.group, equip);
        activeModelRef.current = item.group;
        rootGroup.add(item.group);
      }

      applyPremiumModelFlags(rootGroup);
      rotatingGroup = effectiveCharacterPreview ? rootGroup : item?.group ?? rootGroup;

      if (effectiveCharacterPreview) {
        setCameraForSize(12.5, 4.7);
        resetViewRef.current = () => setCameraForSize(12.5, 4.7);
      } else if (item) {
        const targetY = item.size.y * 0.48;
        setCameraForSize(item.maxDim, targetY);
        resetViewRef.current = () => setCameraForSize(item.maxDim, targetY);
      }

      const expectedTexture = item?.expectedTexture || `${baseName(smdFile.name)}.*`;
      setInfo({
        modelName: smdFile.name,
        modelPath: smdPath,
        modelSize: readableSize(smdFile.size),
        triangles: item?.triangles ?? 0,
        vertices: item?.vertices ?? 0,
        expectedTexture,
        matchedTexture: item?.matchedTexture?.name ?? "",
        textureStatus: item?.textureStatus ?? "none",
        objectCount: item?.objectCount ?? 0,
        bounds: item?.bounds ?? "-",
        assetCount: extraFiles.length,
        previewLabel: options.showcase
          ? "Showcase 3D"
          : effectiveCharacterPreview
            ? skipEquipment ? `Personagem real · ${characterName}` : `${characterName} · ${SLOT_LABELS[equipSlot]}`
            : "Modelo isolado",
        characterName,
        characterTexture,
      });

      setErrors([...localErrors, ...(item?.errors ?? [])]);
      finishLoading(item?.textureStatus === "loaded" ? "Modelo e textura carregados" : "Modelo carregado");
    }

    loadScene().catch(error => {
      setErrors(prev => [...prev, `Erro inesperado: ${(error as Error).message}`]);
      setLoading({ active: false, progress: 0, title: "Carregando modelo 3D", detail: "Falha ao carregar" });
    });

    function animate() {
      animationId = requestAnimationFrame(animate);
      // Auto giro removido por padrão: o modelo só se move por ação do usuário ou ajuste manual.
      if (rotatingGroup) { /* parado */ }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      const nextWidth = Math.max(1, host.clientWidth);
      const nextHeight = Math.max(1, host.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      if (loadingTimer) window.clearTimeout(loadingTimer);
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            for (const mat of obj.material) {
              mat.map?.dispose?.();
              mat.dispose?.();
            }
          } else {
            obj.material.map?.dispose?.();
            obj.material.dispose?.();
          }
        }
      });
      renderer.dispose();
      rendererRef.current = null;
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [smdFile, smdPath, extraFiles, characterFile, characterPath, options, characterClass]);

  function toggleOption(name: keyof ViewOptions) {
    setOptions(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function activateShowcase() {
    setOptions(prev => {
      if (prev.showcase) return { ...prev, showcase: false };
      return {
        ...prev,
        showcase: true,
        characterPreview: false,
        textured: true,
        wireframe: false,
        grid: false,
        axes: false,
        darkBackground: true,
        autoRotate: false,
      };
    });
  }

  function activateCharacterPreview() {
    setOptions(prev => ({ ...prev, characterPreview: !prev.characterPreview, showcase: false }));
  }

  function toggleFullscreen() {
    const element = mountRef.current?.parentElement;
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      element.requestFullscreen?.();
    }
  }

  function changeSlot(nextSlot: EquipSlot) {
    setEquipSlot(nextSlot);
    setEquip(DEFAULT_EQUIP[nextSlot]);
    setCopiedPreset(false);
  }

  function updateEquip(name: keyof EquipTransform, value: number | boolean) {
    setEquip(prev => ({ ...prev, [name]: value }));
    setCopiedPreset(false);
  }

  function resetManualTransform() {
    setEquipSlot("free");
    setEquip(DEFAULT_EQUIP.free);
    setCopiedPreset(false);
  }

  function exportPng() {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const link = document.createElement("a");
    link.download = `${smdFile.name.replace(/\.[^.]+$/, "")}_${options.showcase ? "showcase" : options.characterPreview ? "character" : "preview"}.png`;
    link.href = renderer.domElement.toDataURL("image/png");
    link.click();
  }

  async function copyPreset() {
    const json = buildPresetJson(smdFile, equipSlot, equip, characterClass, characterFile);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedPreset(true);
    } catch {
      window.prompt("Copie o preset:", json);
    }
  }

  const textureClass = info?.textureStatus === "loaded" ? "good"
    : info?.textureStatus === "missing" ? "warn"
    : info?.textureStatus === "error" ? "bad"
    : "muted";

  return (
    <div className={`viewer-shell ${options.showcase ? "showcase-mode" : ""}`}>
      <div ref={mountRef} className="canvas-host" />
      {loading.active && (
        <div className="model-loading-overlay" aria-live="polite">
          <div className="model-loading-card">
            <div className="model-loading-title">{loading.title}</div>
            <div className="model-loading-detail">{loading.detail}</div>
            <div className="model-loading-bar"><span style={{ width: `${loading.progress}%` }} /></div>
            <div className="model-loading-percent">{Math.round(loading.progress)}%</div>
          </div>
        </div>
      )}
      <div className="watermark">ALUCARD-TOOLS</div>

      <div className="viewer-toolbar">
        <button type="button" className={options.showcase ? "active showcase-button" : "showcase-button"} onClick={activateShowcase}>Showcase</button>
        <button type="button" className={options.textured ? "active" : ""} onClick={() => toggleOption("textured")}>Textura</button>
        <button type="button" className={options.wireframe ? "active" : ""} onClick={() => toggleOption("wireframe")}>Wireframe</button>
        <button type="button" className={options.grid ? "active" : ""} onClick={() => toggleOption("grid")}>Grid</button>
        <button type="button" className={options.axes ? "active" : ""} onClick={() => toggleOption("axes")}>Eixos</button>
        <button type="button" className={showTransformPanel ? "active" : ""} onClick={() => setShowTransformPanel(prev => !prev)}>Ajuste manual</button>
        <button type="button" className={options.ptAxisFix ? "active" : ""} onClick={() => toggleOption("ptAxisFix")}>Eixo PT</button>
        <button type="button" onClick={() => toggleOption("darkBackground")}>Fundo</button>
        <button type="button" onClick={() => resetViewRef.current?.()}>Centralizar</button>
        <button type="button" onClick={toggleFullscreen}>Tela cheia</button>
        <button type="button" className="export" onClick={exportPng}>Exportar PNG</button>
      </div>

      <div className="help-pill">{options.showcase ? "Showcase: modelo parado · use Ajuste manual ou arraste a câmera" : "Mouse: girar · Scroll: zoom · Direito: mover"}</div>

      {/* Personagem preview removido: somente Showcase profissional para modelos isolados. */}



      {showTransformPanel && info && (
        <div className="manual-transform-panel">
          <div className="manual-title">
            <strong>Ajuste manual do objeto</strong>
            <span>Move, gira e escala o objeto livremente. Auto giro fica desligado.</span>
          </div>
          <div className="manual-range-grid">
            <label><span>X</span><input type="range" min="-80" max="80" step="0.1" value={equip.offsetX} onChange={event => updateEquip("offsetX", Number(event.target.value))} /><b>{equip.offsetX.toFixed(1)}</b></label>
            <label><span>Y</span><input type="range" min="-80" max="80" step="0.1" value={equip.offsetY} onChange={event => updateEquip("offsetY", Number(event.target.value))} /><b>{equip.offsetY.toFixed(1)}</b></label>
            <label><span>Z</span><input type="range" min="-80" max="80" step="0.1" value={equip.offsetZ} onChange={event => updateEquip("offsetZ", Number(event.target.value))} /><b>{equip.offsetZ.toFixed(1)}</b></label>
            <label><span>Rot X</span><input type="range" min="-180" max="180" step="1" value={equip.rotationX} onChange={event => updateEquip("rotationX", Number(event.target.value))} /><b>{equip.rotationX.toFixed(0)}°</b></label>
            <label><span>Rot Y</span><input type="range" min="-180" max="180" step="1" value={equip.rotationY} onChange={event => updateEquip("rotationY", Number(event.target.value))} /><b>{equip.rotationY.toFixed(0)}°</b></label>
            <label><span>Rot Z</span><input type="range" min="-180" max="180" step="1" value={equip.rotationZ} onChange={event => updateEquip("rotationZ", Number(event.target.value))} /><b>{equip.rotationZ.toFixed(0)}°</b></label>
            <label><span>Escala</span><input type="range" min="0.05" max="5" step="0.01" value={equip.scale} onChange={event => updateEquip("scale", Number(event.target.value))} /><b>{equip.scale.toFixed(2)}</b></label>
          </div>
          <div className="manual-actions">
            <button type="button" onClick={resetManualTransform}>Reset objeto</button>
            <button type="button" onClick={copyPreset}>{copiedPreset ? "Copiado" : "Copiar ajuste"}</button>
          </div>
        </div>
      )}

      {options.showcase && info && (
        <div className="showcase-panel">
          <div className="showcase-kicker">ALUCARD-TOOLS SHOWCASE</div>
          <h2>{info.modelName}</h2>
          <p>{info.modelPath}</p>
          <div className="showcase-stats">
            <span><strong>{info.triangles.toLocaleString()}</strong> triângulos</span>
            <span><strong>{info.vertices.toLocaleString()}</strong> vértices</span>
            <span><strong>{info.objectCount.toLocaleString()}</strong> objetos</span>
            <span><strong>{info.bounds}</strong> bounds</span>
          </div>
          <div className="showcase-texture-row">
            <span>Textura</span>
            <strong className={textureClass}>
              {info.textureStatus === "loaded" && info.matchedTexture}
              {info.textureStatus === "missing" && `faltando: ${info.expectedTexture}`}
              {info.textureStatus === "error" && "erro ao carregar"}
              {info.textureStatus === "none" && "sem textura informada"}
            </strong>
          </div>
          {info.textureStatus === "missing" && (
            <div className="texture-fix-card">
              <strong>Textura não importada</strong>
              <span>Abra a pasta completa do cliente ou selecione também o arquivo <b>{info.expectedTexture}</b>.</span>
            </div>
          )}
        </div>
      )}

      {options.showcase && (
        <div className="showcase-footer">
          <span>Arraste para girar</span>
          <span>Scroll para zoom</span>
          <span>Exportar PNG para catálogo</span>
        </div>
      )}
      {(info || errors.length > 0) && !options.showcase && (
        <div className="diagnostic-panel">
          {info && (
            <div className="diagnostic-grid">
              <div className="diagnostic-main">
                <span className="label">Modelo</span>
                <strong>{info.modelName}</strong>
                <small>{info.modelPath}</small>
              </div>
              <div><span className="label">Preview</span><strong>{info.previewLabel}</strong></div>
              <div><span className="label">Triângulos</span><strong>{info.triangles.toLocaleString()}</strong></div>
              <div><span className="label">Vértices</span><strong>{info.vertices.toLocaleString()}</strong></div>
              <div><span className="label">Objetos</span><strong>{info.objectCount.toLocaleString()}</strong></div>
              <div><span className="label">Tamanho</span><strong>{info.modelSize}</strong></div>
              <div><span className="label">Bounds</span><strong>{info.bounds}</strong></div>
              <div><span className="label">Assets</span><strong>{info.assetCount.toLocaleString()}</strong></div>
              <div className="diagnostic-texture">
                <span className="label">Textura do item</span>
                <strong className={textureClass}>
                  {info.textureStatus === "loaded" && `OK: ${info.matchedTexture}`}
                  {info.textureStatus === "missing" && `Faltando: ${info.expectedTexture}`}
                  {info.textureStatus === "error" && `Erro: ${info.matchedTexture || info.expectedTexture}`}
                  {info.textureStatus === "none" && "Não informada no SMD"}
                </strong>
              </div>
              {options.characterPreview && (
                <div className="diagnostic-texture character-diagnostic">
                  <span className="label">Personagem</span>
                  <strong>{info.characterName}</strong>
                  <small>{info.characterTexture}</small>
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <div className="error-box">
              {errors.slice(0, 5).map((error, index) => <div key={`${error}-${index}`}>⚠ {error}</div>)}
              {errors.length > 5 && <div>+{errors.length - 5} avisos</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
