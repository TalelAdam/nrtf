"use client";

import { Activity, Cpu, Eye, EyeOff, Flag, Gauge, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIoTStore } from "@/store/iot-store";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type SectionInfo = {
  id: string;
  name: string;
  type: string;
  status: "Nominal" | "Inspect" | "Offline";
  temperature: string;
  vibration: string;
  efficiency: string;
  notes: string;
};

type TargetRecord = {
  key: string;
  object: THREE.Object3D;
  info: SectionInfo;
  sphere: THREE.Sphere;
  helper: THREE.Box3Helper;
  hitbox: THREE.Mesh;
};

type SavedCameraView = {
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
};

type SavedFlag = {
  id: string;
  name: string;
  objectKey: string;
  objectName: string;
  coordinate: [number, number, number];
  camera: SavedCameraView;
};

const CAMERA_VIEW_STORAGE_KEY = "reteqfusion:viewer-camera-views:v1";
const FLAG_STORAGE_KEY = "reteqfusion:viewer-flags:v1";

const sectionProfiles = [
  {
    type: "Thermal exchange loop",
    notes:
      "Waste heat recovery segment. Monitor delta-T drift and fouling indicators.",
  },
  {
    type: "Rotating equipment",
    notes:
      "Pump or compressor assembly. Watch vibration trend before load changes.",
  },
  {
    type: "Process vessel",
    notes: "Static asset zone. Compare shell temperature with audit baseline.",
  },
  {
    type: "Instrumentation cluster",
    notes:
      "Sensor-dense section. Validate live telemetry against document intake records.",
  },
];

function normalizeObjectName(name: string) {
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function makeObjectKey(object: THREE.Object3D, index: number) {
  const normalizedName = normalizeObjectName(object.name);

  return normalizedName ? `${normalizedName}:${index}` : `mesh:${index}`;
}

function cleanSectionName(name: string, index: number) {
  const cleaned = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  return cleaned && !/^mesh$/i.test(cleaned)
    ? cleaned
    : `Asset Section ${index + 1}`;
}

function buildSectionInfo(object: THREE.Object3D, index: number): SectionInfo {
  const profile = sectionProfiles[index % sectionProfiles.length];
  const name = cleanSectionName(object.name, index);
  const load = 72 + ((index * 7) % 22);

  return {
    id: object.uuid,
    name,
    type: profile.type,
    status: index % 9 === 0 ? "Inspect" : "Nominal",
    temperature: `${36 + ((index * 5) % 38)} C`,
    vibration: `${(0.8 + ((index * 13) % 24) / 10).toFixed(1)} mm/s`,
    efficiency: `${load}%`,
    notes: profile.notes,
  };
}

function readSavedCameraViews(): Record<string, SavedCameraView> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CAMERA_VIEW_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Record<string, SavedCameraView>;
  } catch {
    return {};
  }
}

function writeSavedCameraViews(views: Record<string, SavedCameraView>) {
  window.localStorage.setItem(CAMERA_VIEW_STORAGE_KEY, JSON.stringify(views));
}

function readSavedFlags(): SavedFlag[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FLAG_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as SavedFlag[]) : [];
  } catch {
    return [];
  }
}

function writeSavedFlags(flags: SavedFlag[]) {
  window.localStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify(flags));
}

function vectorToTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function tupleToVector(tuple: [number, number, number]) {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function createFlagSprite(name: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = 260;
  const height = 104;

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  if (context) {
    context.scale(pixelRatio, pixelRatio);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(7, 12, 18, 0.88)";
    context.strokeStyle = "#37d576";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(38, 10, 206, 42, 6);
    context.fill();
    context.stroke();
    context.fillStyle = "#37d576";
    context.beginPath();
    context.moveTo(20, 12);
    context.lineTo(74, 12);
    context.lineTo(64, 36);
    context.lineTo(20, 36);
    context.closePath();
    context.fill();
    context.strokeStyle = "#f4fbff";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(20, 10);
    context.lineTo(20, 84);
    context.stroke();
    context.fillStyle = "#f4fbff";
    context.font = "600 15px sans-serif";
    context.textBaseline = "middle";
    context.fillText(name.slice(0, 24), 50, 31, 178);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    depthTest: false,
    depthWrite: false,
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.78, 0.31, 1);
  sprite.renderOrder = 999;

  return sprite;
}

export function ThreeViewer({ modelPath }: { modelPath: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const saveCurrentViewRef = useRef<() => void>(() => undefined);
  const createFlagRef = useRef<() => void>(() => undefined);
  const focusFlagRef = useRef<(flagId: string) => void>(() => undefined);
  const [selectedSection, setSelectedSection] = useState<SectionInfo | null>(
    null,
  );
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(
    null,
  );
  const [flags, setFlags] = useState<SavedFlag[]>([]);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tempAlert = useIoTStore((s) => s.tempAlert);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    let frameId = 0;
    let disposed = false;
    let pointerStart: { x: number; y: number } | null = null;
    const clickableTargets: THREE.Object3D[] = [];
    const targetByUuid = new Map<string, TargetRecord>();
    const targetByKey = new Map<string, TargetRecord>();
    const targetRecords: TargetRecord[] = [];
    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];
    const flagSprites = new Map<string, THREE.Sprite>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const savedCameraViews = readSavedCameraViews();
    let savedFlags = readSavedFlags();
    let selectedRecord: TargetRecord | null = null;
    setFlags(savedFlags);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1117");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(4, 2.6, 5);
    const cameraGoal = {
      position: camera.position.clone(),
      target: new THREE.Vector3(0, 0, 0),
      active: false,
    };
    const modelCenter = new THREE.Vector3(0, 0, 0);
    let modelRadius = 2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#0f1117", 1);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    scene.add(new THREE.AmbientLight("#ffffff", 1.75));

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
    keyLight.position.set(4, 7, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#00e5ff", 0.9);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(8, 16, "#00e5ff", "#1d2f38");
    grid.position.y = -1.9;
    scene.add(grid);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const setPointerFromEvent = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    };

    const getTargetFromEvent = (event: PointerEvent) => {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(clickableTargets, false);

      return hit?.object ?? null;
    };

    const setRecordVisualState = (record: TargetRecord, selected: boolean) => {
      record.helper.visible = selected;
      const helperMaterial = record.helper.material as THREE.LineBasicMaterial;

      helperMaterial.color.set(selected ? "#37d576" : "#00e5ff");
      helperMaterial.opacity = selected ? 1 : 0.68;
    };

    const focusRecord = (record: TargetRecord) => {
      selectedRecord = record;
      targetRecords.forEach((targetRecord) =>
        setRecordVisualState(targetRecord, targetRecord === record),
      );

      const radius = Math.max(
        record.sphere.radius * 1.3,
        modelRadius * 0.045,
        0.08,
      );
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1));
      const fitFov = Math.min(verticalFov, horizontalFov);
      const distance = Math.max(
        (radius / Math.sin(fitFov / 2)) * 1.65,
        modelRadius * 0.28,
        0.8,
      );
      const savedView = savedCameraViews[record.key];

      if (savedView) {
        cameraGoal.position.copy(tupleToVector(savedView.position));
        cameraGoal.target.copy(tupleToVector(savedView.target));
        controls.minDistance = savedView.minDistance;
        controls.maxDistance = savedView.maxDistance;
      } else {
        const outwardDirection = record.sphere.center.clone().sub(modelCenter);

        if (outwardDirection.lengthSq() < 0.001) {
          outwardDirection.copy(camera.position).sub(controls.target);
        }

        outwardDirection.y += 0.18;
        outwardDirection.normalize();

        cameraGoal.target.copy(record.sphere.center);
        cameraGoal.position
          .copy(record.sphere.center)
          .add(outwardDirection.multiplyScalar(distance));
        controls.minDistance = Math.max(radius * 0.45, 0.08);
        controls.maxDistance = Math.max(distance * 5, modelRadius * 1.6);
      }

      cameraGoal.active = true;

      camera.near = Math.max(distance / 120, 0.001);
      camera.far = Math.max(modelRadius * 80, distance * 40);
      camera.updateProjectionMatrix();
      setSelectedSection(record.info);
      setSelectedTargetKey(record.key);
      setSaveNotice(savedView ? "Saved camera view loaded" : null);
    };

    const focusObject = (object: THREE.Object3D) => {
      const record = targetByUuid.get(object.uuid);

      if (record) {
        focusRecord(record);
      }
    };

    saveCurrentViewRef.current = () => {
      if (!selectedRecord) {
        return;
      }

      savedCameraViews[selectedRecord.key] = {
        position: vectorToTuple(camera.position),
        target: vectorToTuple(controls.target),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
      };
      writeSavedCameraViews(savedCameraViews);
      setSaveNotice("Camera view saved for this object");
    };

    const addFlagToScene = (flag: SavedFlag) => {
      const existing = flagSprites.get(flag.id);

      if (existing) {
        scene.remove(existing);
      }

      const sprite = createFlagSprite(flag.name);
      sprite.position.copy(tupleToVector(flag.coordinate));
      scene.add(sprite);
      flagSprites.set(flag.id, sprite);
    };

    savedFlags.forEach(addFlagToScene);

    createFlagRef.current = () => {
      if (!selectedRecord) {
        return;
      }

      const fallbackName = selectedRecord.info.name || "Inspection Flag";
      const name = window.prompt("Flag name", fallbackName);

      if (!name?.trim()) {
        return;
      }

      const coordinate = selectedRecord.sphere.center
        .clone()
        .add(
          new THREE.Vector3(
            0,
            Math.max(selectedRecord.sphere.radius * 1.25, 0.14),
            0,
          ),
        );
      const flag: SavedFlag = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        name: name.trim(),
        objectKey: selectedRecord.key,
        objectName: selectedRecord.info.name,
        coordinate: vectorToTuple(coordinate),
        camera: {
          position: vectorToTuple(camera.position),
          target: vectorToTuple(controls.target),
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
        },
      };

      savedFlags = [flag, ...savedFlags];
      writeSavedFlags(savedFlags);
      setFlags(savedFlags);
      addFlagToScene(flag);
      setSaveNotice("Flag saved with object coordinate and zoom view");
    };

    focusFlagRef.current = (flagId: string) => {
      const flag = savedFlags.find((item) => item.id === flagId);

      if (!flag) {
        return;
      }

      const record = targetByKey.get(flag.objectKey);

      if (record) {
        selectedRecord = record;
        targetRecords.forEach((targetRecord) =>
          setRecordVisualState(targetRecord, targetRecord === record),
        );
        setSelectedSection(record.info);
        setSelectedTargetKey(record.key);
      }

      cameraGoal.position.copy(tupleToVector(flag.camera.position));
      cameraGoal.target.copy(tupleToVector(flag.camera.target));
      controls.minDistance = flag.camera.minDistance;
      controls.maxDistance = flag.camera.maxDistance;
      cameraGoal.active = true;
      setSaveNotice(`Loaded flag: ${flag.name}`);
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart || event.button !== 0) {
        return;
      }

      const movement = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      );
      pointerStart = null;

      if (movement > 5) {
        return;
      }

      const target = getTargetFromEvent(event);

      if (target) {
        focusObject(target);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      renderer.domElement.style.cursor = getTargetFromEvent(event)
        ? "crosshair"
        : "grab";
    };

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("contextmenu", preventContextMenu);

    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        if (disposed) {
          return;
        }

        const model = gltf.scene;
        const initialBox = new THREE.Box3().setFromObject(model);
        const center = initialBox.getCenter(new THREE.Vector3());
        const size = initialBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 1);
        const scale = 3.8 / maxDimension;

        model.position.sub(center);
        model.scale.setScalar(scale);
        scene.add(model);
        model.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
        modelCenter.copy(sphere.center);
        modelRadius = Math.max(sphere.radius, 1.8);

        let interactiveIndex = 0;

        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }

          object.castShadow = true;
          object.receiveShadow = true;

          const objectKey = makeObjectKey(object, interactiveIndex);
          const sectionInfo = buildSectionInfo(object, interactiveIndex);
          interactiveIndex += 1;

          const objectBox = new THREE.Box3().setFromObject(object);
          const objectSize = objectBox.getSize(new THREE.Vector3());

          if (objectSize.lengthSq() <= 0) {
            return;
          }

          const objectSphere = objectBox.getBoundingSphere(new THREE.Sphere());
          const targetRadius = Math.max(
            objectSphere.radius,
            modelRadius * 0.035,
            0.06,
          );
          const helper = new THREE.Box3Helper(
            objectBox.clone(),
            new THREE.Color("#00e5ff"),
          );
          const helperMaterial = helper.material as THREE.LineBasicMaterial;

          helperMaterial.transparent = true;
          helperMaterial.opacity = 0.62;
          helperMaterial.depthTest = false;
          helper.renderOrder = 997;
          helper.visible = false;
          scene.add(helper);
          disposableMaterials.push(helperMaterial);

          const hitboxSize = new THREE.Vector3(
            Math.max(
              objectSize.x * 1.8,
              targetRadius * 2.8,
              modelRadius * 0.08,
            ),
            Math.max(
              objectSize.y * 1.8,
              targetRadius * 2.8,
              modelRadius * 0.08,
            ),
            Math.max(
              objectSize.z * 1.8,
              targetRadius * 2.8,
              modelRadius * 0.08,
            ),
          );
          const hitboxGeometry = new THREE.BoxGeometry(
            hitboxSize.x,
            hitboxSize.y,
            hitboxSize.z,
          );
          const hitboxMaterial = new THREE.MeshBasicMaterial({
            depthTest: false,
            depthWrite: false,
            opacity: 0.002,
            transparent: true,
          });
          const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
          const record: TargetRecord = {
            key: objectKey,
            object,
            info: sectionInfo,
            sphere: objectSphere.clone(),
            helper,
            hitbox,
          };

          hitbox.position.copy(objectSphere.center);
          hitbox.renderOrder = 996;
          scene.add(hitbox);
          disposableGeometries.push(hitboxGeometry);
          disposableMaterials.push(hitboxMaterial);
          targetRecords.push(record);
          targetByKey.set(objectKey, record);
          [hitbox, helper].forEach((target) => {
            clickableTargets.push(target);
            targetByUuid.set(target.uuid, record);
          });

          clickableTargets.push(object);
          targetByUuid.set(object.uuid, record);
        });
        const radius = modelRadius;
        const cameraDistance =
          radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));

        camera.near = radius / 100;
        camera.far = radius * 100;
        camera.position.set(
          cameraDistance * 0.65,
          radius * 0.45,
          cameraDistance,
        );
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.maxDistance = cameraDistance * 2.4;
        controls.minDistance = radius * 0.35;
        controls.update();

        setIsLoading(false);
      },
      undefined,
      (loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the GLB model.",
        );
        setIsLoading(false);
      },
    );

    const animate = () => {
      const elapsed = performance.now();

      targetRecords.forEach((record, index) => {
        const selected = selectedRecord === record;
        const wave = Math.sin(elapsed * 0.004 + index * 1.7);
        const helperMaterial = record.helper
          .material as THREE.LineBasicMaterial;

        helperMaterial.opacity = selected ? 1 : 0.58 + wave * 0.1;
      });

      if (cameraGoal.active) {
        camera.position.lerp(cameraGoal.position, 0.08);
        controls.target.lerp(cameraGoal.target, 0.08);

        if (
          camera.position.distanceTo(cameraGoal.position) < 0.02 &&
          controls.target.distanceTo(cameraGoal.target) < 0.02
        ) {
          cameraGoal.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener(
        "contextmenu",
        preventContextMenu,
      );
      controls.dispose();
      renderer.dispose();
      disposableGeometries.forEach((geometry) => geometry.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      renderer.domElement.remove();
      flagSprites.forEach((sprite) => {
        scene.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        }
      });
      saveCurrentViewRef.current = () => undefined;
      createFlagRef.current = () => undefined;
      focusFlagRef.current = () => undefined;
    };
  }, [modelPath]);

  return (
    <>
      <button
        aria-label={
          controlsVisible ? "Hide viewer controls" : "Show viewer controls"
        }
        className="controls-toggle"
        onClick={() => setControlsVisible((visible) => !visible)}
        type="button"
      >
        {controlsVisible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
      <div className={`viewer-controls${controlsVisible ? "" : " hidden"}`}>
        <div className="panel-title">
          <Cpu size={20} strokeWidth={1.8} />
          3D Viewer <span>{modelPath}</span>
        </div>
        <div className="viewer-hint">Click any visible part to inspect it</div>
        <aside className="section-picker" aria-label="Saved flags">
          <div className="section-picker-title">Saved Flags</div>
          <div className="section-picker-list">
            {flags.length > 0 ? (
              flags.map((flag) => (
                <button
                  className={`section-picker-item${
                    selectedTargetKey === flag.objectKey ? " selected" : ""
                  }`}
                  key={flag.id}
                  onClick={() => focusFlagRef.current(flag.id)}
                  type="button"
                >
                  <span>{flag.name}</span>
                  <small>
                    {flag.objectName} |{" "}
                    {flag.coordinate
                      .map((value) => value.toFixed(2))
                      .join(", ")}
                  </small>
                </button>
              ))
            ) : (
              <div className="empty-flags">
                Select an object, then create a flag.
              </div>
            )}
          </div>
        </aside>
      </div>
      <div className="viewer-canvas" ref={mountRef} />
      {selectedSection ? (
        <aside
          className={`section-drawer${controlsVisible ? "" : " controls-hidden"}`}
          aria-label="Selected model section"
        >
          <button
            aria-label="Close section details"
            className="drawer-close"
            onClick={() => {
              setSelectedSection(null);
              setSelectedTargetKey(null);
              setSaveNotice(null);
            }}
            type="button"
          >
            <X size={16} />
          </button>
          <div className="drawer-kicker">Selected Section</div>
          <h2>{selectedSection.name}</h2>
          <div
            className={`drawer-status ${selectedSection.status.toLowerCase()}`}
          >
            {selectedSection.status}
          </div>

          {selectedTargetKey ? (
            <div className="camera-save-panel">
              <button
                className="save-view-button"
                onClick={() => saveCurrentViewRef.current()}
                type="button"
              >
                Save Current View
              </button>
              <button
                className="save-view-button flag-button"
                onClick={() => createFlagRef.current()}
                type="button"
              >
                <Flag size={15} />
                Create Flag Here
              </button>
              <span>
                {saveNotice ??
                  "Adjust orbit/zoom manually, then save the view or create a named flag."}
              </span>
            </div>
          ) : null}

          <div className="metric-grid">
            <div>
              <Gauge size={16} />
              <span>Efficiency</span>
              <strong>{selectedSection.efficiency}</strong>
            </div>
            <div>
              <Activity size={16} />
              <span>Vibration</span>
              <strong>{selectedSection.vibration}</strong>
            </div>
          </div>

          <dl className="section-facts">
            <div>
              <dt>Type</dt>
              <dd>{selectedSection.type}</dd>
            </div>
            <div>
              <dt>Temperature</dt>
              <dd>{selectedSection.temperature}</dd>
            </div>
            <div>
              <dt>Asset ID</dt>
              <dd>{selectedSection.id.slice(0, 8).toUpperCase()}</dd>
            </div>
          </dl>

          <p>{selectedSection.notes}</p>
        </aside>
      ) : null}
      {/* Temperature alert red dot overlay */}
      {tempAlert && (
        <div style={{
          position: 'absolute',
          top: 18,
          right: 18,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#ef4444',
            boxShadow: '0 0 0 0 rgba(239,68,68,0.7)',
            animation: 'temp-alert-pulse 1s ease-out infinite',
          }} />
          <span style={{
            fontSize: '0.55rem',
            color: '#ef4444',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>TEMP</span>
        </div>
      )}
      {isLoading ? (
        <div className="loading-overlay">
          <div className="spinner">Loading plant asset</div>
        </div>
      ) : null}
      {error ? <div className="viewer-error">{error}</div> : null}
    </>
  );
}
