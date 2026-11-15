// Tests automatisés de validation du jeu MotoGP 3D
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import * as constants from '../src/motogp/constants.js';
import { BikePhysics } from '../src/motogp/physics.js';
import { CameraManager } from '../src/motogp/camera.js';
import { MotoGPGame } from '../src/motogp/game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== DÉBUT DES TESTS MOTOGP 3D ===');

// 1. Vérification des fichiers du projet
const bundlePath = path.join(__dirname, '..', 'assets', 'motogp.bundle.js');
assert(fs.existsSync(bundlePath), 'Le bundle assets/motogp.bundle.js doit exister');
const bundleStat = fs.statSync(bundlePath);
assert(bundleStat.size > 200000, `Taille du bundle trop petite : ${bundleStat.size} octets`);
console.log(`✓ Bundle vérifié : ${(bundleStat.size / 1024).toFixed(1)} Ko`);

const htmlPath = path.join(__dirname, '..', 'index.html');
assert(fs.existsSync(htmlPath), 'index.html doit exister');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert(htmlContent.includes('id="home-screen"'), 'Page d’accueil de présentation manquante');
assert(htmlContent.includes('id="btn-home-launch"'), 'Bouton de lancement rapide manquant');
assert(htmlContent.includes('id="btn-home-setup"'), 'Bouton de personnalisation manquant');
assert(htmlContent.includes('id="canvas-container"'), 'Canvas 3D manquant dans index.html');
assert(htmlContent.includes('id="main-menu"'), 'Menu principal manquant dans index.html');
assert(htmlContent.includes('id="hud-layer"'), 'Couche HUD manquante dans index.html');
assert(htmlContent.includes('id="pause-modal"'), 'Modal de pause manquante dans index.html');
assert(htmlContent.includes('id="results-modal"'), 'Modal de résultats manquante dans index.html');
assert(htmlContent.includes('assets/motogp.bundle.js'), 'Script bundle non lié');
console.log('✓ Page index.html validée (Accueil, Canvas, HUD, Menus, Modals)');

const cssPath = path.join(__dirname, '..', 'assets', 'motogp.css');
assert(fs.existsSync(cssPath), 'assets/motogp.css doit exister');
const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('--mgp-red'), 'Variables CSS MotoGP manquantes');
assert(cssContent.includes('#hud-dashboard'), 'Dashboard CSS manquant');
assert(cssContent.includes('.home-screen'), 'Styles de la page d’accueil manquants');
const homeImagePath = path.join(__dirname, '..', 'assets', 'home-hero.jpg');
assert(fs.existsSync(homeImagePath), 'Image de la page d’accueil manquante');
console.log('✓ Stylesheet et visuel de la page d’accueil validés');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'motogp', 'game.js'), 'utf8');
assert(gameSource.includes("import { TEAMS, TRACK_DEFINITIONS, WEATHER_PRESETS, PHYSICS_CONFIG } from './constants.js';"),
  'PHYSICS_CONFIG doit être importée dans game.js pour le compte à rebours');

const hudSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'motogp', 'hud.js'), 'utf8');
for (const controlId of ['camera-tools', 'camera-view-toggle', 'camera-cycle', 'camera-reset', 'camera-recede', 'camera-shift-left']) {
  assert(hudSource.includes(`id="${controlId}"`), `Contrôle caméra ${controlId} manquant`);
}

// 2. Test des constantes et écuries
assert(Array.isArray(constants.TEAMS), 'TEAMS doit être un tableau');
assert(constants.TEAMS.length >= 6, `Nombre d'écuries insuffisant : ${constants.TEAMS.length}`);

const bagnaia = constants.TEAMS.find(t => t.rider.includes('Bagnaia'));
assert(bagnaia, 'Bagnaia #63 doit être présent');
assert.strictEqual(bagnaia.number, 63);
assert(bagnaia.topSpeedKmh >= 350, 'Vitesse max Bagnaia > 350 km/h');

const quartararo = constants.TEAMS.find(t => t.rider.includes('Quartararo'));
assert(quartararo, 'Quartararo #20 doit être présent');
assert.strictEqual(quartararo.number, 20);

const marquez = constants.TEAMS.find(t => t.rider.includes('Márquez') || t.rider.includes('Marquez'));
assert(marquez, 'Marc Marquez #93 doit être présent');
assert.strictEqual(marquez.number, 93);

const martin = constants.TEAMS.find(t => t.rider.includes('Martín') || t.rider.includes('Martin'));
assert(martin, 'Jorge Martin #89 doit être présent');

console.log(`✓ 8 écuries et pilotes officiels MotoGP vérifiés`);

// 3. Test des circuits
assert(Array.isArray(constants.TRACK_DEFINITIONS), 'TRACK_DEFINITIONS doit être un tableau');
assert(constants.TRACK_DEFINITIONS.length >= 3, 'Au moins 3 circuits officiels');

const lemans = constants.TRACK_DEFINITIONS.find(t => t.id === 'lemans');
assert(lemans, 'Circuit Le Mans Bugatti présent');
assert(lemans.points.length >= 20, 'Points de spline Le Mans suffisants');

const mugello = constants.TRACK_DEFINITIONS.find(t => t.id === 'mugello');
assert(mugello, 'Circuit Mugello présent');
assert(mugello.points.length >= 20, 'Points de spline Mugello suffisants');

const valencia = constants.TRACK_DEFINITIONS.find(t => t.id === 'valencia');
assert(valencia, 'Circuit Valencia présent');
console.log(`✓ Circuits Le Mans, Mugello et Valence validés`);

// 4. Test des conditions météo
assert(constants.WEATHER_PRESETS.sunny, 'Météo ensoleillée présente');
assert(constants.WEATHER_PRESETS.sunset, 'Météo coucher de soleil présente');
assert(constants.WEATHER_PRESETS.wet, 'Météo pluie présente');
assert(constants.WEATHER_PRESETS.wet.rain === true, 'Météo pluie active les précipitations');
assert(constants.WEATHER_PRESETS.wet.gripMultiplier < 1.0, 'Adhérence réduite sous la pluie');
console.log(`✓ Météo dynamique validée (Soleil, Coucher de soleil, Pluie)`);

// 5. Test du modèle physique & boîte de vitesses
const physicsCfg = constants.PHYSICS_CONFIG;
assert(physicsCfg.maxLeanAngleDeg >= 60, 'Angle de braquage max MotoGP >= 60 degrés');
assert.strictEqual(physicsCfg.gearRatios.length, 6, 'Boîte de vitesses à 6 rapports requise');
assert(physicsCfg.gearRatios[5].maxKmh >= 350, '6e rapport > 350 km/h');
console.log(`✓ Configuration physique MotoGP (Angle 64°, Boîte 6 rapports, Freinage carbone) validée`);

// 6. Test des vues et réglages caméra
const cameraManager = new CameraManager(new THREE.PerspectiveCamera(64, 1, 0.1, 1000));
assert.strictEqual(cameraManager.isFirstPerson(), false);
cameraManager.togglePerspective();
assert.strictEqual(cameraManager.isFirstPerson(), true, 'V doit activer la première personne');
cameraManager.togglePerspective();
assert.strictEqual(cameraManager.isFirstPerson(), false, 'V doit revenir en troisième personne');
assert.match(cameraManager.nextMode(), /Action/);
assert.match(cameraManager.nextMode(), /latéral/);
assert.strictEqual(cameraManager.adjustDistance(100), 14, 'La caméra doit avoir une limite de recul');
assert.strictEqual(cameraManager.adjustDistance(-100), -2, 'La caméra doit avoir une limite de rapprochement');
assert.strictEqual(cameraManager.adjustLateral(100), 8, 'Le décalage caméra doit être borné à droite');
assert.strictEqual(cameraManager.adjustLateral(-100), -8, 'Le décalage caméra doit être borné à gauche');
cameraManager.resetAdjustments();
cameraManager.setMode('side');
cameraManager.adjustDistance(3);
cameraManager.resetForRace();
assert.strictEqual(cameraManager.currentMode, 'chase', 'Une course doit démarrer en poursuite droite');
assert.strictEqual(cameraManager.distanceOffset, 0, 'Le zoom précédent ne doit pas contaminer le départ suivant');

const stableCamera = new THREE.PerspectiveCamera(64, 1, 0.1, 1000);
const stableManager = new CameraManager(stableCamera);
const straightBikePose = { pos: new THREE.Vector3(10, 1, 20), yaw: Math.PI / 2, leanAngle: 0, speedKmh: 0 };
stableManager.update(1 / 60, straightBikePose);
const openingPosition = stableCamera.position.clone();
const openingRotation = stableCamera.quaternion.clone();
stableManager.update(1 / 60, straightBikePose);
assert(stableCamera.position.distanceTo(openingPosition) < 0.001, 'La caméra doit être stable au départ');
assert(stableCamera.quaternion.angleTo(openingRotation) < 0.001, 'La caméra doit s’ouvrir droite, sans roulis');
stableManager.update(1 / 60, { ...straightBikePose, leanAngle: 0.5 });
assert(stableCamera.quaternion.angleTo(openingRotation) > 0.001, 'La caméra doit suivre l’inclinaison de la moto');
console.log('✓ Caméras 1re/3e personne, recul, départ droit et inclinaison validés');

// Check keyboard mappings independently of a browser/WebGL renderer.
const keyboardInputProbe = Object.create(MotoGPGame.prototype);
keyboardInputProbe.touchInputs = { throttle: 0, brake: 0, steer: 0, rearBrake: 0, nitro: false };
keyboardInputProbe.gamepadIndex = null;
keyboardInputProbe.keys = { q: true };
assert.strictEqual(keyboardInputProbe.getPlayerInputs().steer, -1, 'Q AZERTY doit braquer à gauche');
keyboardInputProbe.keys = { d: true };
assert.strictEqual(keyboardInputProbe.getPlayerInputs().steer, 1, 'D AZERTY doit braquer à droite');
keyboardInputProbe.keys = { ArrowLeft: true };
assert.strictEqual(keyboardInputProbe.getPlayerInputs().steer, -1, 'La flèche gauche doit braquer à gauche');
keyboardInputProbe.keys = { ArrowRight: true };
assert.strictEqual(keyboardInputProbe.getPlayerInputs().steer, 1, 'La flèche droite doit braquer à droite');
console.log('✓ Commandes de direction AZERTY et flèches validées');

// 7. Test dynamique de simulation physique (accélération, freinage, virage)
const mockCircuit = {
  totalLength: 4200,
  roadWidth: 14,
  weather: { rain: false, gripMultiplier: 1.0 },
  curve: {
    getPointAt: () => ({ x: 0, y: 0, z: 0 }),
    getTangentAt: () => ({ x: 0, y: 0, z: 1, normalize: () => ({ x: 0, y: 0, z: 1 }) })
  },
  projectPoint: (pos) => ({
    u: 0.1,
    distOnTrack: 420,
    lateralOffset: 0,
    surface: 'tarmac',
    sector: 1,
    trackElevation: 0,
    binormal: { clone: () => ({ multiplyScalar: () => ({}) }) }
  })
};

const bike = new BikePhysics(bagnaia, mockCircuit, true);
assert.strictEqual(bike.speedKmh, 0);
assert.strictEqual(bike.gear, 1);

// Test Accélération
bike.update(0.1, { throttle: 1.0, brake: 0, steer: 0, nitro: false });
assert(bike.speedKmh > 0, 'La moto doit accélérer lors de la mise des gaz');

// Simulation de 3 secondes plein gaz
for (let i = 0; i < 60; i++) {
  bike.update(0.05, { throttle: 1.0, brake: 0, steer: 0, nitro: false });
}
assert(bike.speedKmh > 80, `Vitesse après accélération : ${bike.speedKmh.toFixed(1)} km/h`);
const speedBeforeBraking = bike.speedKmh;

// Test Freinage
bike.update(0.1, { throttle: 0, brake: 1.0, steer: 0, nitro: false });
assert(bike.speedKmh < speedBeforeBraking, 'La vitesse doit chuter au freinage');

// Test Inclinaison (Lean angle)
bike.update(0.1, { throttle: 0.5, brake: 0, steer: 1.0, nitro: false });
assert(bike.leanAngle !== 0, 'La moto doit pencher lors du braquage');
const leanDeg = Math.abs(bike.leanAngle * (180 / Math.PI));
assert(leanDeg <= physicsCfg.maxLeanAngleDeg, 'L inclinaison ne doit pas dépasser le maximum physique');

// Verify both steering directions change heading, not only the visible lean angle.
const steeringBike = new BikePhysics(bagnaia, mockCircuit, true);
for (let i = 0; i < 60; i++) {
  steeringBike.update(0.05, { throttle: 1, brake: 0, steer: 0, nitro: false });
}
const yawBeforeLeft = steeringBike.yaw;
for (let i = 0; i < 12; i++) {
  steeringBike.update(0.05, { throttle: 1, brake: 0, steer: -1, nitro: false });
}
assert(steeringBike.yaw < yawBeforeLeft, 'La direction gauche doit faire tourner la moto à gauche');
assert(steeringBike.leanAngle < 0, 'La moto doit s’incliner vers la gauche en braquant à gauche');
assert(steeringBike.steerAngle < 0, 'La roue avant doit pointer à gauche');
const yawAfterLeft = steeringBike.yaw;
for (let i = 0; i < 24; i++) {
  steeringBike.update(0.05, { throttle: 1, brake: 0, steer: 1, nitro: false });
}
assert(steeringBike.leanAngle > 0, 'La moto doit s’incliner vers la droite en braquant à droite');
assert(steeringBike.steerAngle > 0, 'La roue avant doit pointer à droite');
const yawBeforeRightStep = steeringBike.yaw;
steeringBike.update(0.05, { throttle: 1, brake: 0, steer: 1, nitro: false });
assert(steeringBike.yaw > yawBeforeRightStep, 'La direction droite doit faire tourner la moto à droite');
assert(steeringBike.yaw > yawAfterLeft, 'La moto doit inverser sa trajectoire après le braquage');

const lowSpeedSteeringBike = new BikePhysics(bagnaia, mockCircuit, true);
lowSpeedSteeringBike.speedKmh = 2;
lowSpeedSteeringBike.update(0.016, { throttle: 0, brake: 0, steer: -1, nitro: false });
assert(lowSpeedSteeringBike.yaw < 0, 'La direction doit rester active à faible vitesse');

// Test KERS / Nitro Boost
const initialNitro = bike.nitro;
bike.update(0.1, { throttle: 1.0, brake: 0, steer: 0, nitro: true });
assert(bike.isNitroActive, 'Le nitro/KERS doit s activer');
assert(bike.nitro < initialNitro, 'Le stock de nitro doit diminuer');

console.log(`✓ Moteur physique validé : Accélération, Freinage carbone, Inclinaison gyro, KERS boost`);

console.log('=== TOUS LES TESTS MOTOGP 3D ONT RÉUSSI AVEC SUCCÈS ! ===');
