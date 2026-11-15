// Caméras MotoGP : poursuite, travelling latéral et vues embarquées.
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
    this.camera.updateProjectionMatrix();

    // Réglages de caméra conservés lors des changements de vue.
    this.distanceOffset = 0; // valeur positive = caméra plus éloignée
    this.lateralOffset = 0; // valeur positive = caméra décalée à droite
    this.heightOffset = 0;
    this.shake = 0;
  }

  setMode(mode) {
    const index = this.modes.indexOf(mode);
    if (index < 0) return this.getModeName();
    this.modeIndex = index;
    this.currentMode = mode;
    return this.getModeName();
  }

  nextMode() {
    this.modeIndex = (this.modeIndex + 1) % this.modes.length;
    this.currentMode = this.modes[this.modeIndex];
    return this.getModeName();
  }

  isFirstPerson() {
    return FIRST_PERSON_MODES.has(this.currentMode);
  }

  togglePerspective() {
    return this.setMode(this.isFirstPerson() ? 'chase' : 'helmet');
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

  update(dt, playerPhys) {
    if (!playerPhys) return;

    const pos = playerPhys.pos;
    const yaw = playerPhys.yaw;
    const lean = playerPhys.leanAngle;
    const speed = playerPhys.speedKmh;

    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();

    // Sensation de vitesse cinéma : légère ouverture du champ de vision.
    const fovTarget = this.baseFov + Math.min(22, (speed / 350) * 22);
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    // Vibrations subtiles à haute vitesse.
    if (speed > 160) {
      const shakeAmt = ((speed - 160) / 200) * 0.025;
      this.shake = (Math.random() - 0.5) * shakeAmt;
    } else {
      this.shake = 0;
    }

    if (THIRD_PERSON_MODES.has(this.currentMode)) {
      const presets = {
        chase: { distance: 7.2, height: 2.7, side: 0, lookAhead: 5.5, lookHeight: 0.9, smoothing: 6, roll: 0.12 },
        action: { distance: 4.5, height: 1.55, side: 0, lookAhead: 8, lookHeight: 0.7, smoothing: 8, roll: 0.2 },
        side: { distance: 7.6, height: 2.8, side: 5.5, lookAhead: 3.5, lookHeight: 1.05, smoothing: 5, roll: 0.08 }
      };
      const preset = presets[this.currentMode];
      const speedPullback = Math.min(1.8, (speed / 350) * 1.8);
      const distance = Math.max(2.8, preset.distance + this.distanceOffset + speedPullback);
      const cameraHeight = Math.max(0.7, preset.height + this.heightOffset);

      const targetPos = pos.clone()
        .addScaledVector(fwd, -distance)
        .addScaledVector(right, preset.side + this.lateralOffset + lean * 0.25)
        .add(new THREE.Vector3(0, cameraHeight, 0));
      const lookTarget = pos.clone()
        .addScaledVector(fwd, preset.lookAhead)
        .add(new THREE.Vector3(0, preset.lookHeight, 0));

      const follow = 1 - Math.exp(-dt * preset.smoothing);
      this.smoothPos.lerp(targetPos, follow);
      this.smoothLook.lerp(lookTarget, 1 - Math.exp(-dt * (preset.smoothing + 2)));

      this.camera.position.copy(this.smoothPos).add(new THREE.Vector3(0, this.shake, 0));
      this.camera.lookAt(this.smoothLook);
      this.camera.rotation.z = -lean * preset.roll;
      return;
    }

    if (this.currentMode === 'helmet') {
      // Vue à hauteur du casque, alignée sur le regard du pilote.
      const helmetPos = pos.clone()
        .addScaledVector(fwd, 0.38)
        .add(new THREE.Vector3(0, 1.34, 0));
      const lookTarget = pos.clone()
        .addScaledVector(fwd, 22)
        .add(new THREE.Vector3(0, 1.18, 0));

      this.camera.position.copy(helmetPos).add(new THREE.Vector3(0, this.shake * 0.8, 0));
      this.camera.lookAt(lookTarget);
      this.camera.rotation.z = -lean * 0.48;
      return;
    }

    if (this.currentMode === 'gyro') {
      // Caméra embarquée au-dessus de la selle, horizon stabilisé.
      const tailPos = pos.clone()
        .addScaledVector(fwd, -1.25)
        .add(new THREE.Vector3(0, 1.42, 0));
      const lookTarget = pos.clone()
        .addScaledVector(fwd, 18)
        .add(new THREE.Vector3(0, 0.95, 0));

      this.camera.position.copy(tailPos).add(new THREE.Vector3(0, this.shake, 0));
      this.camera.lookAt(lookTarget);
      this.camera.rotation.z = 0;
    }
  }
}
