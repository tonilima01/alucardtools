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

const CLASS_LABELS: CharacterClass[] = ["Knight", "Fighter", "Pikeman", "Archer", "Atalanta", "Mechanician", "Magician", "Priestess"];
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
  const normalizedCandidates = uniqueStrings(candidates);

  for (const candidate of normalizedCandidates) {
    const expectedFile = justFileName(candidate);
    const expectedBase = baseName(candidate);
    const exact = textures.find(file => justFileName(file.name) === expectedFile);
    if (exact) return exact;
    const sameBase = textures.find(file => baseName(file.name) === expectedBase && expectedBase.length > 0);
    if (sameBase) return sameBase;
  }

  return textures.find(file => baseName(file.name) === smdBase)
    ?? textures.find(file => baseName(file.name).includes(smdBase) && smdBase.length >= 3)
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

function classTint(characterClass: CharacterClass): number {
  switch (characterClass) {
    case "Knight": return 0x8ea4ff;
    case "Fighter": return 0xff8d63;
    case "Pikeman": return 0xa89bff;
    case "Archer": return 0x80e5a0;
    case "Atalanta": return 0xffc56c;
    case "Mechanician": return 0x9cc7d8;
    case "Magician": return 0x96b3ff;
    case "Priestess": return 0xffacd7;
  }
}

function makeMaterial(color: number, opacity = 1, metalness = 0.06) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness,
    transparent: opacity < 1,
    opacity,
  });
}

function createMannequin(characterClass: CharacterClass) {
  const group = new THREE.Group();
  group.name = "ALUCARD-TOOLS Technical Mannequin";

  const tint = classTint(characterClass);
  const bodyMat = makeMaterial(tint, 0.48, 0.02);
  const jointMat = makeMaterial(0xe8edff, 0.62, 0.04);
  const darkMat = makeMaterial(0x192032, 0.72, 0.02);

  const addBox = (name: string, size: [number, number, number], pos: [number, number, number], mat: any) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    mesh.name = name;
    mesh.position.set(pos[0], pos[1], pos[2]);
    group.add(mesh);
  };

  const addSphere = (name: string, radius: number, pos: [number, number, number], mat: any) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat);
    mesh.name = name;
    mesh.position.set(pos[0], pos[1], pos[2]);
    group.add(mesh);
  };

  addBox("torso", [2.2, 3.15, 1.05], [0, 5.35, 0], bodyMat);
  addBox("waist", [1.75, 0.8, 0.9], [0, 3.55, 0], darkMat);
  addSphere("head", 0.78, [0, 7.55, 0], jointMat);
  addBox("neck", [0.55, 0.38, 0.55], [0, 6.7, 0], darkMat);

  addBox("rightUpperArm", [0.55, 2.15, 0.55], [-1.65, 5.45, 0], bodyMat);
  addBox("rightForearm", [0.48, 1.95, 0.48], [-2.32, 4.25, 0.12], jointMat);
  addSphere("rightHandAnchor", 0.35, [-2.35, 3.2, 0.18], darkMat);

  addBox("leftUpperArm", [0.55, 2.15, 0.55], [1.65, 5.45, 0], bodyMat);
  addBox("leftForearm", [0.48, 1.95, 0.48], [2.32, 4.25, 0.12], jointMat);
  addSphere("leftHandAnchor", 0.35, [2.35, 3.2, 0.18], darkMat);

  addBox("rightLeg", [0.68, 3.1, 0.68], [-0.55, 1.65, 0], bodyMat);
  addBox("leftLeg", [0.68, 3.1, 0.68], [0.55, 1.65, 0], bodyMat);
  addBox("rightFoot", [0.88, 0.35, 1.35], [-0.55, 0.05, 0.25], darkMat);
  addBox("leftFoot", [0.88, 0.35, 1.35], [0.55, 0.05, 0.25], darkMat);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.95, 0.035, 8, 96),
    makeMaterial(0x6e7dff, 0.42, 0.2),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  return group;
}

function buildPresetJson(smdFile: File, equipSlot: EquipSlot, equip: EquipTransform, characterClass: CharacterClass, characterFile?: File | null): string {
  return JSON.stringify({
    tool: "ALUCARD-TOOLS",
    model: smdFile.name,
    realCharacter: characterFile?.name ?? "technical-mannequin",
    characterClass,
    slot: equipSlot,
    anchor: SLOT_LABELS[equipSlot],
    offset: { x: equip.offsetX, y: equip.offsetY, z: equip.offsetZ },
    rotation: { x: equip.rotationX, y: equip.rotationY, z: equip.rotationZ },
    scale: equip.scale,
    autoFit: equip.autoFit,
  }, null, 2);
}

async function buildSmdModel(file: File, extraFiles: File[], textured: boolean, wireframe: boolean, fallbackColor: number): Promise<BuiltSmdModel> {
  const errors: string[] = [];
  const meshData = parseSmd(await file.arrayBuffer());

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(meshData.positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(meshData.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const textureNames = uniqueStrings([meshData.textureName, ...meshData.textureNames]);
  const expectedTexture = textureNames[0] ?? "";
  const matchedTexture = findTextureFile(textureNames, file, extraFiles);
  let textureStatus: ViewerInfo["textureStatus"] = textureNames.length > 0 ? "missing" : "none";
  let textureMap: any = null;

  if (matchedTexture) {
    try {
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
  const [info, setInfo] = useState<ViewerInfo | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedPreset, setCopiedPreset] = useState(false);
  const [characterClass, setCharacterClass] = useState<CharacterClass>("Knight");
  const [equipSlot, setEquipSlot] = useState<EquipSlot>("weapon");
  const [equip, setEquip] = useState<EquipTransform>(DEFAULT_EQUIP.weapon);
  const [options, setOptions] = useState<ViewOptions>({
    textured: true,
    wireframe: false,
    grid: true,
    axes: true,
    autoRotate: false,
    darkBackground: true,
    characterPreview: true,
    ptAxisFix: false,
  });

  useEffect(() => {
    const nextSlot = guessSlotFromName(smdFile.name);
    setEquipSlot(nextSlot);
    setEquip(DEFAULT_EQUIP[nextSlot]);
    setCopiedPreset(false);
  }, [smdFile]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    const host: HTMLDivElement = mountEl;

    setErrors([]);
    setInfo(null);
    resetViewRef.current = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.darkBackground ? 0x070914 : 0x232a3a);

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 50000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xdbe6ff, 0x202030, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.65);
    keyLight.position.set(9, 12, 7);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8aa0ff, 0.75);
    rimLight.position.set(-10, 7, -8);
    scene.add(rimLight);

    if (options.grid) {
      const grid = new THREE.GridHelper(options.characterPreview ? 18 : 80, options.characterPreview ? 18 : 40, 0x465075, 0x20263d);
      scene.add(grid);
    }
    if (options.axes) {
      const axes = new THREE.AxesHelper(options.characterPreview ? 4 : 8);
      scene.add(axes);
    }

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    let disposed = false;
    let animationId = 0;
    let rotatingGroup: any = null;

    function setCameraForSize(maxDim: number, targetY: number) {
      const safeDim = Math.max(maxDim, 1);
      const fov = camera.fov * (Math.PI / 180);
      const distance = Math.abs(safeDim / Math.sin(fov / 2)) * 0.82;
      camera.near = Math.max(0.01, distance / 2000);
      camera.far = Math.max(5000, distance * 40);
      camera.position.set(distance * 0.88, distance * 0.48, distance * 0.92);
      camera.updateProjectionMatrix();
      controls.target.set(0, targetY, 0);
      controls.update();
    }

    async function loadScene() {
      const localErrors: string[] = [];
      const skipEquipment = options.characterPreview && isSameFile(smdFile, characterFile);
      let characterName = "Manequim técnico";
      let characterTexture = "Manequim";

      if (options.characterPreview) {
        if (characterFile) {
          try {
            const character = await buildSmdModel(characterFile, extraFiles, options.textured, false, 0x9aa8ff);
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
            rootGroup.add(createMannequin(characterClass));
            characterName = "Manequim técnico";
            characterTexture = "Falha no personagem real";
          }
        } else {
          rootGroup.add(createMannequin(characterClass));
        }
      }

      let item: BuiltSmdModel | null = null;
      if (!skipEquipment) {
        try {
          item = await buildSmdModel(smdFile, extraFiles, options.textured, options.wireframe, 0xaab6ff);
        } catch (error) {
          setErrors(prev => [...prev, ...localErrors, `Erro ao ler SMD: ${(error as Error).message}`]);
          return;
        }
      } else {
        try {
          item = await buildSmdModel(smdFile, extraFiles, options.textured, options.wireframe, 0xaab6ff);
        } catch {
          item = null;
        }
      }

      if (disposed) return;

      if (options.ptAxisFix) {
        rootGroup.rotation.x = -Math.PI / 2;
      }

      if (item && !skipEquipment) {
        if (options.characterPreview) {
          const anchor = getAnchor(equipSlot);
          const autoScale = equip.autoFit ? getFitSize(equipSlot) / item.maxDim : 1;
          item.group.position.set(anchor.x + equip.offsetX, anchor.y + equip.offsetY, anchor.z + equip.offsetZ);
          item.group.rotation.set(degToRad(equip.rotationX), degToRad(equip.rotationY), degToRad(equip.rotationZ));
          item.group.scale.setScalar(Math.max(0.01, autoScale * equip.scale));
        }
        rootGroup.add(item.group);
      }

      rotatingGroup = options.characterPreview ? rootGroup : item?.group ?? rootGroup;

      if (options.characterPreview) {
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
        previewLabel: options.characterPreview
          ? skipEquipment ? `Personagem real · ${characterName}` : `${characterName} · ${SLOT_LABELS[equipSlot]}`
          : "Modelo isolado",
        characterName,
        characterTexture,
      });

      setErrors([...localErrors, ...(item?.errors ?? [])]);
    }

    loadScene().catch(error => {
      setErrors(prev => [...prev, `Erro inesperado: ${(error as Error).message}`]);
    });

    function animate() {
      animationId = requestAnimationFrame(animate);
      if (options.autoRotate && rotatingGroup) rotatingGroup.rotation.y += 0.012;
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
  }, [smdFile, smdPath, extraFiles, characterFile, characterPath, options, equipSlot, equip, characterClass]);

  function toggleOption(name: keyof ViewOptions) {
    setOptions(prev => ({ ...prev, [name]: !prev[name] }));
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

  function exportPng() {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const link = document.createElement("a");
    link.download = `${smdFile.name.replace(/\.[^.]+$/, "")}_${options.characterPreview ? "character" : "preview"}.png`;
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
    <div className="viewer-shell">
      <div ref={mountRef} className="canvas-host" />
      <div className="watermark">ALUCARD-TOOLS</div>

      <div className="viewer-toolbar">
        <button type="button" className={options.characterPreview ? "active" : ""} onClick={() => toggleOption("characterPreview")}>Personagem</button>
        <button type="button" className={options.textured ? "active" : ""} onClick={() => toggleOption("textured")}>Textura</button>
        <button type="button" className={options.wireframe ? "active" : ""} onClick={() => toggleOption("wireframe")}>Wireframe</button>
        <button type="button" className={options.grid ? "active" : ""} onClick={() => toggleOption("grid")}>Grid</button>
        <button type="button" className={options.axes ? "active" : ""} onClick={() => toggleOption("axes")}>Eixos</button>
        <button type="button" className={options.autoRotate ? "active" : ""} onClick={() => toggleOption("autoRotate")}>Auto giro</button>
        <button type="button" className={options.ptAxisFix ? "active" : ""} onClick={() => toggleOption("ptAxisFix")}>Eixo PT</button>
        <button type="button" onClick={() => toggleOption("darkBackground")}>Fundo</button>
        <button type="button" onClick={() => resetViewRef.current?.()}>Centralizar</button>
        <button type="button" className="export" onClick={exportPng}>Exportar PNG</button>
      </div>

      <div className="help-pill">Mouse: girar · Scroll: zoom · Direito: mover</div>

      {options.characterPreview && (
        <div className="equip-panel">
          <div className="equip-title">
            <strong>Preview no personagem</strong>
            <span>{info?.characterName ?? (characterFile ? characterFile.name : "Manequim técnico")}</span>
          </div>

          <div className="real-character-status">
            <span>Base</span>
            <strong>{characterFile ? "SMD real" : "Manequim técnico"}</strong>
            {characterFile && <small>{characterPath || characterFile.name}</small>}
          </div>

          {!characterFile && (
            <label>
              Classe base
              <select value={characterClass} onChange={event => setCharacterClass(event.target.value as CharacterClass)}>
                {CLASS_LABELS.map(label => <option key={label} value={label}>{label}</option>)}
              </select>
            </label>
          )}

          <label>
            Slot
            <select value={equipSlot} onChange={event => changeSlot(event.target.value as EquipSlot)}>
              {Object.entries(SLOT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="check-row">
            <input type="checkbox" checked={equip.autoFit} onChange={event => updateEquip("autoFit", event.target.checked)} />
            Auto ajustar escala
          </label>

          <div className="range-grid">
            <label>X <input type="range" min="-5" max="5" step="0.05" value={equip.offsetX} onChange={event => updateEquip("offsetX", Number(event.target.value))} /><span>{equip.offsetX.toFixed(2)}</span></label>
            <label>Y <input type="range" min="-5" max="5" step="0.05" value={equip.offsetY} onChange={event => updateEquip("offsetY", Number(event.target.value))} /><span>{equip.offsetY.toFixed(2)}</span></label>
            <label>Z <input type="range" min="-5" max="5" step="0.05" value={equip.offsetZ} onChange={event => updateEquip("offsetZ", Number(event.target.value))} /><span>{equip.offsetZ.toFixed(2)}</span></label>
            <label>Rot X <input type="range" min="-180" max="180" step="1" value={equip.rotationX} onChange={event => updateEquip("rotationX", Number(event.target.value))} /><span>{equip.rotationX}°</span></label>
            <label>Rot Y <input type="range" min="-180" max="180" step="1" value={equip.rotationY} onChange={event => updateEquip("rotationY", Number(event.target.value))} /><span>{equip.rotationY}°</span></label>
            <label>Rot Z <input type="range" min="-180" max="180" step="1" value={equip.rotationZ} onChange={event => updateEquip("rotationZ", Number(event.target.value))} /><span>{equip.rotationZ}°</span></label>
            <label>Escala <input type="range" min="0.05" max="4" step="0.05" value={equip.scale} onChange={event => updateEquip("scale", Number(event.target.value))} /><span>{equip.scale.toFixed(2)}</span></label>
          </div>

          <div className="equip-actions">
            <button type="button" onClick={() => setEquip(DEFAULT_EQUIP[equipSlot])}>Reset slot</button>
            <button type="button" onClick={copyPreset}>{copiedPreset ? "Copiado" : "Copiar preset"}</button>
          </div>
        </div>
      )}

      {(info || errors.length > 0) && (
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
