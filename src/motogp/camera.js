// Caméras MotoGP : vues stables en poursuite, de côté et embarquées.
import * as THREE from 'three';

const THIRD_PERSON_MODES = new Set(['chase', 'action', 'side']);
const FIRST_PERSON_MODES = new Set(['helmet', 'gyro']);

export class CameraManager {
  constructor(camera) {
    this.camera = camera;
    this.modes = ['chase', 'action', 'side', 'helmet', 'gyro'];
    this.modeIndex = 0;
    this.currentMode = this.modes[0];

    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();
    this.baseFov = 64;
    this.camera.fov = this.baseFov;
    this.camera.up.set(0, 1, 0);
    this.camera.updateProjectionMatrix();

    this.distanceOffset = 0; // Valeur positive = caméra plus éloignée.
    this.lateralOffset = 0; // Valeur positive = caméra décalée à droite.
    this.heightOffset = 0;
    this.currentRoll = 0;
    this.poseInitialized = false;
  }

  setMode(mode) {
    const index = this.modes.indexOf(mode);
    if (index < 0) return this.getModeName();
    if (this.currentMode !== mode) {
      this.modeIndex = index;
      this.currentMode = mode;
      this.poseInitialized = false;
      this.currentRoll = 0;
    }
    return this.getModeName();
  }

  nextMode() {
    return this.setMode(this.modes[(this.modeIndex + 1) % this.modes.length]);
  }

  isFirstPerson() {
    return FIRST_PERSON_MODES.has(this.currentMode);
  }

  togglePerspective() {
    return this.setMode(this.isFirstPerson() ? 'chase' : 'helmet');
  }

  resetForRace() {
    this.modeIndex = 0;
    this.currentMode = 'chase';
    this.resetAdjustments();
    this.smoothPos.set(0, 0, 0);
    this.smoothLook.set(0, 0, 0);
    this.currentRoll = 0;
    this.poseInitialized = false;
    this.camera.up.set(0, 1, 0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  adjustDistance(amount) {
    this.distanceOffset = THREE.MathUtils.clamp(this.distanceOffset + amount, -2, 14);
    return this.distanceOffset;
  }

  adjustLateral(amount) {
    this.lateralOffset = THREE.MathUtils.clamp(this.lateralOffset + amount, -8, 8);
    return this.lateralOffset;
  }

  adjustHeight(amount) {
    this.heightOffset = THREE.MathUtils.clamp(this.heightOffset + amount, -2, 5);
    return this.heightOffset;
  }

  resetAdjustments() {
    this.distanceOffset = 0;
    this.lateralOffset = 0;
    this.heightOffset = 0;
  }

  getModeName() {
    switch (this.currentMode) {
      case 'chase': return '3e personne — Poursuite';
      case 'action': return '3e personne — Action';
      case 'side': return '3e personne — Travelling latéral';
      case 'helmet': return '1re personne — Casque (FPV)';
      case 'gyro': return '1re personne — Caméra embarquée';
      default: return '3e personne — Poursuite';
    }
  }

  aimAt(target, lean, bankFactor, dt) {
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);

    const targetRoll = -lean * bankFactor;
    if (!this.poseInitialized) {
      this.currentRoll = targetRoll;
    } else {
      const bankSmoothing = 1 - Math.exp(-dt * 8);
      this.currentRoll += (targetRoll - this.currentRoll) * bankSmoothing;
    }

    // Bank around the camera's viewing axis, without accumulating roll frame-to-frame.
    if (Math.abs(this.currentRoll) > 0.0001) {
      const viewAxis = new THREE.Vector3().subVectors(target, this.camera.position).normalize();
      const bank = new THREE.Quaternion().setFromAxisAngle(viewAxis, this.currentRoll);
      this.camera.quaternion.premultiply(bank);
    }
    this.poseInitialized = true;
  }

  update(dt, playerPhys) {
    if (!playerPhys) return;
    dt = Math.max(0, dt);

    const pos = playerPhys.pos;
    const yaw = playerPhys.yaw;
    const lean = playerPhys.leanAngle;
    const speed = playerPhys.speedKmh;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();

    // A restrained FOV change gives speed feedback without making the camera feel loose.
    const fovTarget = this.baseFov + Math.min(8, (speed / 350) * 8);
    this.camera.fov += (fovTarget - this.camera.fov) * (1 - Math.exp(-dt * 5));
    this.camera.updateProjectionMatrix();

    if (THIRD_PERSON_MODES.has(this.currentMode)) {
      const presets = {
        chase: { distance: 7.2, height: 2.7, side: 0, lookAhead: 5.5, lookHeight: 0.9, smoothing: 6, bank: 0.28 },
        action: { distance: 4.5, height: 1.55, side: 0, lookAhead: 8, lookHeight: 0.7, smoothing: 8, bank: 0.36 },
        side: { distance: 7.6, height: 2.8, side: 5.5, lookAhead: 3.5, lookHeight: 1.05, smoothing: 5, bank: 0.16 }
      };
      const preset = presets[this.currentMode];
      const distance = Math.max(2.8, preset.distance + this.distanceOffset);
      const cameraHeight = Math.max(0.7, preset.height + this.heightOffset);
      const targetPos = pos.clone()
        .addScaledVector(fwd, -distance)
        .addScaledVector(right, preset.side + this.lateralOffset)
        .add(new THREE.Vector3(0, cameraHeight, 0));
      const lookTarget = pos.clone()
        .addScaledVector(fwd, preset.lookAhead)
        .add(new THREE.Vector3(0, preset.lookHeight, 0));

      if (!this.poseInitialized) {
        // Start exactly behind the bike instead of sweeping in from the world origin.
        this.smoothPos.copy(targetPos);
        this.smoothLook.copy(lookTarget);
      } else {
        this.smoothPos.lerp(targetPos, 1 - Math.exp(-dt * preset.smoothing));
        this.smoothLook.lerp(lookTarget, 1 - Math.exp(-dt * (preset.smoothing + 2)));
      }

      this.camera.position.copy(this.smoothPos);
      this.aimAt(this.smoothLook, lean, preset.bank, dt);
      return;
    }

    if (this.currentMode === 'helmet') {
      const helmetPos = pos.clone()
        .addScaledVector(fwd, 0.38)
        .add(new THREE.Vector3(0, 1.34, 0));
      const lookTarget = pos.clone()
        .addScaledVector(fwd, 22)
        .add(new THREE.Vector3(0, 1.18, 0));
      this.camera.position.copy(helmetPos);
      this.aimAt(lookTarget, lean, 0.52, dt);
      return;
    }

    if (this.currentMode === 'gyro') {
      const tailPos = pos.clone()
        .addScaledVector(fwd, -1.25)
        .add(new THREE.Vector3(0, 1.42, 0));
      const lookTarget = pos.clone()
        .addScaledVector(fwd, 18)
        .add(new THREE.Vector3(0, 0.95, 0));
      this.camera.position.copy(tailPos);
      this.aimAt(lookTarget, lean, 0, dt);
    }
  }
}
