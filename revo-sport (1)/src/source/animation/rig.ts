import * as THREE from "three";

/* =====================================================================
   Revo sport — 3D exercise animation engine
   Character faces +Z, Y is up, the character's left side is +X.
   Limbs are driven by analytic two-bone IK, so bone lengths stay
   constant, feet stay planted and equipment stays in the hands.
   ===================================================================== */

export type V3 = [number, number, number];
export type View = "side" | "front" | "threeQuarter" | "rear";
export type Backdrop = "light" | "dark" | "transparent";

export type MuscleKey =
  | "chest" | "upperChest" | "lats" | "upperBack" | "traps" | "frontDelts" | "sideDelts" | "rearDelts"
  | "biceps" | "brachialis" | "forearms" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves"
  | "abs" | "obliques" | "lowerBack" | "hipFlexors" | "adductors";

export interface Pose {
  pelvis: V3;
  /** Torso lean in degrees: + forward, - backward (−90 = lying on the back, +90 = prone). */
  pitch: number;
  roll?: number;
  yaw?: number;
  /** Extra chest flexion relative to the pelvis (crunch), degrees. */
  spine?: number;
  /** Chest rotation around the spine (Russian twist), degrees. */
  twist?: number;
  head?: number;
  /** Wrist targets. Right side mirrors left (−x) when omitted. */
  hl: V3;
  hr?: V3;
  /** Elbow pole direction for the left arm (mirrored for the right arm). */
  elbow: V3;
  /** Ankle targets. Right side mirrors left (−x) when omitted. */
  fl: V3;
  fr?: V3;
  knee?: V3;
  /** Foot pitch in degrees: + toes down (plantar flexion), − toes up. */
  fpl?: number;
  fpr?: number;
}

export type HandFrame = "world" | "chest" | "pelvis";

export type Prop =
  | { kind: "box"; pos: V3; size: V3; rot?: V3; tone?: "frame" | "pad" | "metal" | "plate" }
  | { kind: "bar"; a: V3; b: V3; r?: number; tone?: "frame" | "metal" | "pad" }
  | { kind: "mat"; pos: V3; size: [number, number] }
  | { kind: "pulley"; pos: V3 }
  | { kind: "yoke"; offset: V3; size: V3 }
  /** Machine roller pad that follows both ankles, with lever arms to a pivot. */
  | { kind: "jointPad"; joint: "ankle"; offset: V3; pivot: V3 };

export type Equip =
  | { kind: "none" }
  | { kind: "barbell"; plates?: boolean; length?: number; plateScale?: number }
  | { kind: "dumbbells"; axis: "x" | "z" | "hammer" | "along"; single?: "l" | "r" | "mid" }
  | { kind: "kettlebell" }
  | { kind: "cable"; pulley: V3; handle: "bar" | "longbar" | "rope" | "v" | "single" }
  | { kind: "band"; anchor: V3 };

/* ---------------- body dimensions (meters) ---------------- */
export const BODY = {
  upperArm: 0.3,
  forearm: 0.27,
  thigh: 0.45,
  shin: 0.44,
  hipHalf: 0.095,
  shoulderHalf: 0.19,
  lumbar: 0.24,
  thoracic: 0.26,
};

const DEG = Math.PI / 180;
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function v(a: V3) {
  return new THREE.Vector3(a[0], a[1], a[2]);
}

/** Analytic two-bone IK. Returns the middle joint (elbow/knee) and the clamped end (wrist/ankle). */
export function solveTwoBone(root: THREE.Vector3, target: THREE.Vector3, a: number, b: number, pole: THREE.Vector3) {
  const d = tmpA.copy(target).sub(root);
  let dist = d.length();
  const dir = dist > 1e-6 ? d.clone().divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  dist = Math.min(Math.max(dist, Math.abs(a - b) + 1e-3), a + b - 1e-4);
  const cosA = THREE.MathUtils.clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const p = tmpB.copy(pole).sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
  p.normalize();
  const mid = root.clone().add(dir.clone().multiplyScalar(a * cosA)).add(p.multiplyScalar(a * sinA));
  const end = root.clone().add(dir.multiplyScalar(dist));
  return { mid, end };
}

/* ---------------- pose numeric flattening (for smooth interpolation) ---------------- */

export function mirrorX(p: V3): V3 {
  return [-p[0], p[1], p[2]];
}

export function flatten(pose: Pose): number[] {
  const hr = pose.hr ?? mirrorX(pose.hl);
  const fr = pose.fr ?? mirrorX(pose.fl);
  const knee = pose.knee ?? [0.12, 0, 1];
  return [
    ...pose.pelvis, pose.pitch, pose.roll ?? 0, pose.yaw ?? 0, pose.spine ?? 0, pose.twist ?? 0, pose.head ?? 0,
    ...pose.hl, ...hr, ...pose.elbow, ...pose.fl, ...fr, ...knee, pose.fpl ?? 0, pose.fpr ?? pose.fpl ?? 0,
  ];
}

export function unflatten(n: number[]): Required<Pose> {
  return {
    pelvis: [n[0], n[1], n[2]], pitch: n[3], roll: n[4], yaw: n[5], spine: n[6], twist: n[7], head: n[8],
    hl: [n[9], n[10], n[11]], hr: [n[12], n[13], n[14]], elbow: [n[15], n[16], n[17]],
    fl: [n[18], n[19], n[20]], fr: [n[21], n[22], n[23]], knee: [n[24], n[25], n[26]], fpl: n[27], fpr: n[28],
  };
}

/** Swaps left/right so a second repetition can be performed on the other side. */
export function mirrorPose(pose: Pose): Pose {
  const hr = pose.hr ?? mirrorX(pose.hl);
  const fr = pose.fr ?? mirrorX(pose.fl);
  return {
    ...pose,
    pelvis: mirrorX(pose.pelvis),
    roll: -(pose.roll ?? 0),
    yaw: -(pose.yaw ?? 0),
    twist: -(pose.twist ?? 0),
    hl: mirrorX(hr),
    hr: mirrorX(pose.hl),
    fl: mirrorX(fr),
    fr: mirrorX(pose.fl),
    fpl: pose.fpr ?? pose.fpl,
    fpr: pose.fpl,
  };
}

/* ---------------- solved skeleton ---------------- */

export interface Skeleton {
  pelvis: THREE.Vector3;
  qPelvis: THREE.Quaternion;
  qChest: THREE.Quaternion;
  qMid: THREE.Quaternion;
  qHead: THREE.Quaternion;
  abdomen: THREE.Vector3;
  spineTop: THREE.Vector3;
  head: THREE.Vector3;
  shoulder: [THREE.Vector3, THREE.Vector3];
  elbow: [THREE.Vector3, THREE.Vector3];
  wrist: [THREE.Vector3, THREE.Vector3];
  grip: [THREE.Vector3, THREE.Vector3];
  hip: [THREE.Vector3, THREE.Vector3];
  knee: [THREE.Vector3, THREE.Vector3];
  ankle: [THREE.Vector3, THREE.Vector3];
  qFoot: [THREE.Quaternion, THREE.Quaternion];
}

function euler(x: number, y: number, z: number, order: THREE.EulerOrder = "YXZ") {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG, order));
}

export function solvePose(pose: Required<Pose>, frame: HandFrame): Skeleton {
  const pelvis = v(pose.pelvis);
  const qPelvis = euler(pose.pitch, pose.yaw, pose.roll);
  const qMid = qPelvis.clone().multiply(euler(pose.spine * 0.5, pose.twist * 0.5, 0));
  const qChest = qPelvis.clone().multiply(euler(pose.spine, pose.twist, 0));
  const qHead = qChest.clone().multiply(euler(pose.head, 0, 0));
  const abdomen = pelvis.clone().add(new THREE.Vector3(0, BODY.lumbar, 0).applyQuaternion(qMid));
  const spineTop = abdomen.clone().add(new THREE.Vector3(0, BODY.thoracic, 0).applyQuaternion(qChest));
  const head = spineTop.clone().add(new THREE.Vector3(0, 0.155, 0.012).applyQuaternion(qHead));
  const shoulder: [THREE.Vector3, THREE.Vector3] = [
    spineTop.clone().add(new THREE.Vector3(BODY.shoulderHalf, -0.035, -0.005).applyQuaternion(qChest)),
    spineTop.clone().add(new THREE.Vector3(-BODY.shoulderHalf, -0.035, -0.005).applyQuaternion(qChest)),
  ];
  const hip: [THREE.Vector3, THREE.Vector3] = [
    pelvis.clone().add(new THREE.Vector3(BODY.hipHalf, -0.045, 0).applyQuaternion(qPelvis)),
    pelvis.clone().add(new THREE.Vector3(-BODY.hipHalf, -0.045, 0).applyQuaternion(qPelvis)),
  ];

  const handTarget = (local: V3) => {
    const p = v(local);
    if (frame === "chest") return p.applyQuaternion(qChest).add(spineTop);
    if (frame === "pelvis") return p.applyQuaternion(qPelvis).add(pelvis);
    return p;
  };
  const poleL = v(pose.elbow);
  const poleR = v(mirrorX(pose.elbow));
  if (frame !== "world") {
    const q = frame === "chest" ? qChest : qPelvis;
    poleL.applyQuaternion(q);
    poleR.applyQuaternion(q);
  }
  const armL = solveTwoBone(shoulder[0], handTarget(pose.hl), BODY.upperArm, BODY.forearm, poleL);
  const armR = solveTwoBone(shoulder[1], handTarget(pose.hr), BODY.upperArm, BODY.forearm, poleR);
  const gripOf = (elbow: THREE.Vector3, wrist: THREE.Vector3) => wrist.clone().add(wrist.clone().sub(elbow).normalize().multiplyScalar(0.055));

  const legL = solveTwoBone(hip[0], v(pose.fl), BODY.thigh, BODY.shin, v(pose.knee));
  const legR = solveTwoBone(hip[1], v(pose.fr), BODY.thigh, BODY.shin, v(mirrorX(pose.knee)));

  return {
    pelvis, qPelvis, qChest, qMid, qHead, abdomen, spineTop, head, shoulder, hip,
    elbow: [armL.mid, armR.mid],
    wrist: [armL.end, armR.end],
    grip: [gripOf(armL.mid, armL.end), gripOf(armR.mid, armR.end)],
    knee: [legL.mid, legR.mid],
    ankle: [legL.end, legR.end],
    qFoot: [euler(pose.fpl, 0, 0, "XYZ"), euler(pose.fpr, 0, 0, "XYZ")],
  };
}

/* ---------------- materials ---------------- */

export interface MaterialSet {
  skin: THREE.MeshStandardMaterial;
  joint: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  pad: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  cable: THREE.MeshStandardMaterial;
  band: THREE.MeshStandardMaterial;
  mat: THREE.MeshStandardMaterial;
}

function makeMaterials(): MaterialSet {
  return {
    skin: new THREE.MeshStandardMaterial({ color: 0xd9dce1, roughness: 0.52, metalness: 0.02 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.45, metalness: 0.1 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.55, metalness: 0.35 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.85, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.22, metalness: 0.9 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.6, metalness: 0.25 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.6 }),
    band: new THREE.MeshStandardMaterial({ color: 0xe9e400, roughness: 0.6, metalness: 0 }),
    mat: new THREE.MeshStandardMaterial({ color: 0x3a3d43, roughness: 0.95, metalness: 0 }),
  };
}

/* ---------------- mannequin ---------------- */

type Region = "chest" | "delts" | "upperArm" | "forearm" | "abdomen" | "glutes" | "thigh" | "shin";

const REGION_OF: Record<MuscleKey, Region[]> = {
  chest: ["chest"], upperChest: ["chest"], lats: ["chest"], upperBack: ["chest"], traps: ["delts", "chest"],
  frontDelts: ["delts"], sideDelts: ["delts"], rearDelts: ["delts"], biceps: ["upperArm"], brachialis: ["upperArm"],
  forearms: ["forearm"], triceps: ["upperArm"], quads: ["thigh"], hamstrings: ["thigh"], adductors: ["thigh"],
  glutes: ["glutes"], calves: ["shin"], abs: ["abdomen"], obliques: ["abdomen"], lowerBack: ["abdomen"], hipFlexors: ["abdomen", "thigh"],
};

function capsule(radius: number, length: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length), 8, 18), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ellipsoid(sx: number, sy: number, sz: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), mat);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function placeBetween(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = tmpA.copy(b).sub(a);
  if (dir.lengthSq() < 1e-10) return;
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

export class Mannequin {
  group = new THREE.Group();
  private regionMats = new Map<Region, THREE.MeshStandardMaterial>();
  private parts: Record<string, THREE.Mesh> = {};

  constructor(mats: MaterialSet) {
    const regionMat = (region: Region) => {
      const m = mats.skin.clone();
      m.emissive = new THREE.Color(0xff9a00);
      m.emissiveIntensity = 0;
      this.regionMats.set(region, m);
      return m;
    };
    const chest = regionMat("chest");
    const delts = regionMat("delts");
    const upperArm = regionMat("upperArm");
    const forearm = regionMat("forearm");
    const abdomen = regionMat("abdomen");
    const glutes = regionMat("glutes");
    const thigh = regionMat("thigh");
    const shin = regionMat("shin");
    const P = this.parts;
    P.pelvis = ellipsoid(0.165, 0.11, 0.115, glutes);
    P.abdomen = ellipsoid(0.135, 0.15, 0.105, abdomen);
    P.chest = ellipsoid(0.175, 0.165, 0.118, chest);
    P.neck = capsule(0.048, 0.06, mats.skin);
    P.head = ellipsoid(0.092, 0.112, 0.102, mats.skin);
    P.jaw = ellipsoid(0.07, 0.06, 0.075, mats.skin);
    P.nose = ellipsoid(0.016, 0.022, 0.018, mats.skin);
    for (const side of ["L", "R"]) {
      P[`delt${side}`] = ellipsoid(0.066, 0.06, 0.064, delts);
      P[`upper${side}`] = capsule(0.047, BODY.upperArm - 0.06, upperArm);
      P[`elbowJ${side}`] = ellipsoid(0.041, 0.041, 0.041, mats.joint);
      P[`fore${side}`] = capsule(0.038, BODY.forearm - 0.05, forearm);
      P[`hand${side}`] = ellipsoid(0.042, 0.052, 0.024, mats.skin);
      P[`thigh${side}`] = capsule(0.074, BODY.thigh - 0.1, thigh);
      P[`kneeJ${side}`] = ellipsoid(0.056, 0.056, 0.056, mats.joint);
      P[`shin${side}`] = capsule(0.054, BODY.shin - 0.08, shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.25), mats.skin);
      foot.geometry.translate(0, -0.045, 0.06);
      foot.castShadow = true;
      P[`foot${side}`] = foot;
    }
    Object.values(P).forEach((mesh) => this.group.add(mesh));
  }

  update(s: Skeleton) {
    const P = this.parts;
    P.pelvis.position.copy(s.pelvis).add(new THREE.Vector3(0, -0.01, -0.01).applyQuaternion(s.qPelvis));
    P.pelvis.quaternion.copy(s.qPelvis);
    P.abdomen.position.copy(s.abdomen).add(new THREE.Vector3(0, -0.03, 0.005).applyQuaternion(s.qMid));
    P.abdomen.quaternion.copy(s.qMid);
    P.chest.position.copy(s.spineTop).add(new THREE.Vector3(0, -0.14, 0.012).applyQuaternion(s.qChest));
    P.chest.quaternion.copy(s.qChest);
    const neckTop = s.spineTop.clone().add(new THREE.Vector3(0, 0.07, 0.01).applyQuaternion(s.qHead));
    placeBetween(P.neck, s.spineTop, neckTop);
    P.head.position.copy(s.head);
    P.head.quaternion.copy(s.qHead);
    P.jaw.position.copy(s.head).add(new THREE.Vector3(0, -0.055, 0.03).applyQuaternion(s.qHead));
    P.jaw.quaternion.copy(s.qHead);
    P.nose.position.copy(s.head).add(new THREE.Vector3(0, -0.01, 0.1).applyQuaternion(s.qHead));
    P.nose.quaternion.copy(s.qHead);
    (["L", "R"] as const).forEach((side, i) => {
      P[`delt${side}`].position.copy(s.shoulder[i]).add(new THREE.Vector3(i === 0 ? 0.012 : -0.012, 0.012, 0).applyQuaternion(s.qChest));
      P[`delt${side}`].quaternion.copy(s.qChest);
      placeBetween(P[`upper${side}`], s.shoulder[i], s.elbow[i]);
      P[`elbowJ${side}`].position.copy(s.elbow[i]);
      placeBetween(P[`fore${side}`], s.elbow[i], s.wrist[i]);
      placeBetween(P[`hand${side}`], s.wrist[i], s.grip[i].clone().add(s.grip[i].clone().sub(s.wrist[i]).multiplyScalar(0.4)));
      placeBetween(P[`thigh${side}`], s.hip[i], s.knee[i]);
      P[`kneeJ${side}`].position.copy(s.knee[i]);
      placeBetween(P[`shin${side}`], s.knee[i], s.ankle[i]);
      P[`foot${side}`].position.copy(s.ankle[i]);
      P[`foot${side}`].quaternion.copy(s.qFoot[i]);
    });
  }

  highlight(primary: MuscleKey[], secondary: MuscleKey[], effort: number, enabled: boolean) {
    const level = new Map<Region, number>();
    if (enabled) {
      secondary.forEach((m) => REGION_OF[m].forEach((r) => level.set(r, Math.max(level.get(r) ?? 0, 0.12 + 0.22 * effort))));
      primary.forEach((m) => REGION_OF[m].forEach((r) => level.set(r, Math.max(level.get(r) ?? 0, 0.28 + 0.5 * effort))));
    }
    this.regionMats.forEach((mat, region) => {
      mat.emissiveIntensity = level.get(region) ?? 0;
    });
  }
}

/* ---------------- equipment ---------------- */

export class EquipmentRig {
  group = new THREE.Group();
  private dynamic: ((s: Skeleton) => void)[] = [];

  constructor(private mats: MaterialSet, equip: Equip, props: Prop[]) {
    props.forEach((prop) => this.addProp(prop));
    this.addEquip(equip);
  }

  private tone(t?: string) {
    if (t === "pad") return this.mats.pad;
    if (t === "metal") return this.mats.metal;
    if (t === "plate") return this.mats.plate;
    return this.mats.frame;
  }

  private add(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private rod(r: number, mat: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 16), mat);
    return this.add(mesh);
  }

  private setRod(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    placeBetween(mesh, a, b);
    mesh.scale.set(1, Math.max(0.001, a.distanceTo(b)), 1);
  }

  private addProp(prop: Prop) {
    if (prop.kind === "box") {
      const geo = new THREE.BoxGeometry(prop.size[0], prop.size[1], prop.size[2]);
      const mesh = this.add(new THREE.Mesh(geo, this.tone(prop.tone ?? "pad")));
      mesh.position.set(...prop.pos);
      if (prop.rot) mesh.rotation.set(prop.rot[0] * DEG, prop.rot[1] * DEG, prop.rot[2] * DEG);
    } else if (prop.kind === "bar") {
      this.setRod(this.rod(prop.r ?? 0.025, this.tone(prop.tone ?? "frame")), v(prop.a), v(prop.b));
    } else if (prop.kind === "mat") {
      const mesh = this.add(new THREE.Mesh(new THREE.BoxGeometry(prop.size[0], 0.012, prop.size[1]), this.mats.mat));
      mesh.position.set(prop.pos[0], 0.006, prop.pos[2]);
    } else if (prop.kind === "pulley") {
      const mesh = this.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 10, 24), this.mats.metal));
      mesh.position.set(...prop.pos);
    } else if (prop.kind === "jointPad") {
      const roller = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.44, 20), this.mats.pad));
      const armL = this.rod(0.018, this.mats.frame);
      const armR = this.rod(0.018, this.mats.frame);
      const offset = v(prop.offset);
      const pivot = v(prop.pivot);
      this.dynamic.push((s) => {
        const center = s.ankle[0].clone().add(s.ankle[1]).multiplyScalar(0.5).add(offset);
        roller.position.copy(center);
        roller.quaternion.setFromUnitVectors(UP, new THREE.Vector3(1, 0, 0));
        this.setRod(armL, new THREE.Vector3(0.25, pivot.y, pivot.z), new THREE.Vector3(0.25, center.y, center.z));
        this.setRod(armR, new THREE.Vector3(-0.25, pivot.y, pivot.z), new THREE.Vector3(-0.25, center.y, center.z));
      });
    } else if (prop.kind === "yoke") {
      const mesh = this.add(new THREE.Mesh(new THREE.BoxGeometry(...prop.size), this.mats.pad));
      const offset = v(prop.offset);
      this.dynamic.push((s) => {
        mesh.position.copy(s.spineTop).add(offset.clone().applyQuaternion(s.qChest));
        mesh.quaternion.copy(s.qChest);
      });
    }
  }

  private addEquip(equip: Equip) {
    const M = this.mats;
    if (equip.kind === "barbell") {
      const length = equip.length ?? 2.0;
      const ps = equip.plateScale ?? 1;
      const bar = this.rod(0.0145, M.metal);
      const plates: THREE.Mesh[] = [];
      const collars: THREE.Mesh[] = [];
      if (equip.plates !== false) {
        for (const sign of [1, -1]) {
          const plate = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.225 * ps, 0.225 * ps, 0.045, 40), M.plate));
          const inner = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16 * ps, 0.16 * ps, 0.035, 32), M.plate));
          const collar = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), M.metal));
          plates.push(plate, inner);
          collars.push(collar);
          plate.userData.sign = sign;
          inner.userData.sign = sign;
          collar.userData.sign = sign;
        }
      }
      this.dynamic.push((s) => {
        const mid = s.grip[0].clone().add(s.grip[1]).multiplyScalar(0.5);
        const axis = s.grip[0].clone().sub(s.grip[1]);
        if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
        axis.normalize();
        this.setRod(bar, mid.clone().addScaledVector(axis, -length / 2), mid.clone().addScaledVector(axis, length / 2));
        const q = new THREE.Quaternion().setFromUnitVectors(UP, axis);
        plates.forEach((plate, i) => {
          const sign = plate.userData.sign as number;
          const offset = length / 2 - (i % 2 === 0 ? 0.28 : 0.23);
          plate.position.copy(mid).addScaledVector(axis, sign * offset);
          plate.quaternion.copy(q);
        });
        collars.forEach((collar) => {
          collar.position.copy(mid).addScaledVector(axis, (collar.userData.sign as number) * (length / 2 - 0.33));
          collar.quaternion.copy(q);
        });
      });
    } else if (equip.kind === "dumbbells") {
      const make = () => {
        const g = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 14), M.metal);
        g.add(handle);
        for (const sign of [1, -1]) {
          const head = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 6), M.plate);
          head.position.y = sign * 0.105;
          g.add(head);
        }
        g.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.group.add(g);
        return g;
      };
      if (equip.single === "mid") {
        const bell = make();
        this.dynamic.push((s) => {
          const fore = s.wrist[0].clone().sub(s.elbow[0]).add(s.wrist[1].clone().sub(s.elbow[1])).normalize();
          bell.position.copy(s.grip[0]).add(s.grip[1]).multiplyScalar(0.5).addScaledVector(fore, 0.05);
          bell.quaternion.setFromUnitVectors(UP, fore);
        });
        return;
      }
      const sides = equip.single === "l" ? [0] : equip.single === "r" ? [1] : [0, 1];
      const bells = sides.map(() => make());
      this.dynamic.push((s) => {
        bells.forEach((bell, k) => {
          const i = sides[k];
          bell.position.copy(s.grip[i]);
          const fore = s.wrist[i].clone().sub(s.elbow[i]).normalize();
          let axis: THREE.Vector3;
          if (equip.axis === "along") {
            bell.quaternion.setFromUnitVectors(UP, fore);
            return;
          }
          if (equip.axis === "x") axis = new THREE.Vector3(1, 0, 0);
          else if (equip.axis === "z") axis = new THREE.Vector3(0, 0, 1);
          else axis = new THREE.Vector3().crossVectors(fore, new THREE.Vector3(1, 0, 0));
          axis.sub(fore.clone().multiplyScalar(axis.dot(fore)));
          if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
          bell.quaternion.setFromUnitVectors(UP, axis.normalize());
        });
      });
    } else if (equip.kind === "kettlebell") {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 20), M.plate);
      body.position.y = -0.13;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 10, 28, Math.PI), M.plate);
      handle.rotation.z = 0;
      g.add(body, handle);
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      this.group.add(g);
      this.dynamic.push((s) => {
        const mid = s.grip[0].clone().add(s.grip[1]).multiplyScalar(0.5);
        const down = s.wrist[0].clone().sub(s.elbow[0]).add(s.wrist[1].clone().sub(s.elbow[1])).normalize();
        g.position.copy(mid);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), down);
      });
    } else if (equip.kind === "cable" || equip.kind === "band") {
      const isBand = equip.kind === "band";
      const anchor = v(equip.kind === "cable" ? equip.pulley : equip.anchor);
      const handle = equip.kind === "cable" ? equip.handle : "single";
      const both = handle === "single";
      const lines = [this.rod(isBand ? 0.012 : 0.005, isBand ? M.band : M.cable), ...(both ? [this.rod(isBand ? 0.012 : 0.005, isBand ? M.band : M.cable)] : [])];
      let handleMesh: THREE.Mesh | null = null;
      if (handle === "bar" || handle === "longbar") handleMesh = this.rod(0.015, M.metal);
      if (handle === "rope") handleMesh = this.rod(0.02, M.pad);
      if (handle === "v") handleMesh = this.rod(0.018, M.metal);
      this.dynamic.push((s) => {
        if (both) {
          this.setRod(lines[0], anchor, s.grip[0]);
          this.setRod(lines[1], anchor, s.grip[1]);
          return;
        }
        const mid = s.grip[0].clone().add(s.grip[1]).multiplyScalar(0.5);
        const axis = s.grip[0].clone().sub(s.grip[1]);
        const half = handle === "longbar" ? 0.6 : handle === "v" ? 0.1 : 0.2;
        if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
        axis.normalize();
        if (handleMesh) this.setRod(handleMesh, mid.clone().addScaledVector(axis, -half), mid.clone().addScaledVector(axis, half));
        this.setRod(lines[0], anchor, mid);
      });
    }
  }

  update(s: Skeleton) {
    this.dynamic.forEach((fn) => fn(s));
  }
}

/* ---------------- studio scene ---------------- */

export class Studio {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 60);
  mats = makeMaterials();
  mannequin = new Mannequin(this.mats);
  equipment: EquipmentRig | null = null;
  private floor: THREE.Mesh;
  private shadowFloor: THREE.Mesh;
  private key: THREE.DirectionalLight;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 1.25);
    this.key = new THREE.DirectionalLight(0xffffff, 2.3);
    this.key.position.set(2.6, 4.2, 3.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -2.6;
    this.key.shadow.camera.right = 2.6;
    this.key.shadow.camera.top = 3;
    this.key.shadow.camera.bottom = -1.6;
    this.key.shadow.camera.far = 14;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.radius = 5;
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.15);
    rim.position.set(-3, 2.4, -3.2);
    const fill = new THREE.DirectionalLight(0xfff4e6, 0.55);
    fill.position.set(-2.5, 1.2, 2.5);
    this.scene.add(hemi, this.key, rim, fill);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0xe4e6ea, roughness: 0.92 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
    this.shadowFloor.rotation.x = -Math.PI / 2;
    this.shadowFloor.position.y = 0.001;
    this.shadowFloor.receiveShadow = true;
    this.scene.add(this.floor, this.shadowFloor, this.mannequin.group);
    this.setBackdrop("light");
  }

  setBackdrop(backdrop: Backdrop) {
    const floorMat = this.floor.material as THREE.MeshStandardMaterial;
    if (backdrop === "transparent") {
      this.scene.background = null;
      this.scene.fog = null;
      this.floor.visible = false;
      this.renderer.setClearColor(0x000000, 0);
      return;
    }
    this.floor.visible = true;
    const light = backdrop === "light";
    const bg = new THREE.Color(light ? 0xe9ebee : 0x15171a);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 7, 16);
    floorMat.color.set(light ? 0xe1e3e7 : 0x1d1f23);
    (this.shadowFloor.material as THREE.ShadowMaterial).opacity = light ? 0.22 : 0.5;
    this.renderer.setClearColor(bg, 1);
  }

  setEquipment(equip: Equip, props: Prop[]) {
    if (this.equipment) {
      this.scene.remove(this.equipment.group);
      this.equipment.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    this.equipment = new EquipmentRig(this.mats, equip, props);
    this.scene.add(this.equipment.group);
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Fixed camera framing that keeps the whole motion envelope visible. */
  frame(box: THREE.Box3, view: View) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dirs: Record<View, THREE.Vector3> = {
      side: new THREE.Vector3(1, 0.1, 0),
      front: new THREE.Vector3(0, 0.1, 1),
      threeQuarter: new THREE.Vector3(0.78, 0.16, 0.62),
      rear: new THREE.Vector3(-0.25, 0.14, -1),
    };
    const dir = dirs[view].normalize();
    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const width = view === "side" ? Math.max(size.z, 0.6) : view === "front" || view === "rear" ? Math.max(size.x, 0.6) : Math.max(size.x, size.z) * 0.95 + 0.2;
    const height = Math.max(size.y, 0.8);
    const distH = (height * 1.16) / 2 / Math.tan(vFov / 2);
    const distW = (width * 1.22) / 2 / Math.tan(hFov / 2);
    const dist = Math.max(distH, distW, 1.6) + Math.max(size.x, size.z) * 0.08;
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.lookAt(center);
    this.key.target.position.copy(center);
    this.key.target.updateMatrixWorld();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}

/** Collects every relevant joint position to frame the camera around the motion envelope. */
export function skeletonPoints(s: Skeleton): THREE.Vector3[] {
  return [s.head.clone().add(new THREE.Vector3(0, 0.12, 0)), s.pelvis, s.spineTop, ...s.shoulder, ...s.elbow, ...s.grip, ...s.hip, ...s.knee, ...s.ankle];
}
