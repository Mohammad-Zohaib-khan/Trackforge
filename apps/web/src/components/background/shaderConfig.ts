import type { GradientT } from '@shadergradient/react';

/**
 * The user-supplied ShaderGradient configuration, kept verbatim as the visual
 * source of truth. Do not edit these values without updating docs/SHADER.md.
 */
export const SHADER_CONFIG = {
  animate: 'on',
  axesHelper: 'off',
  bgColor1: '#000000',
  bgColor2: '#000000',
  brightness: 1.2,
  cAzimuthAngle: 170,
  cDistance: 4.4,
  cPolarAngle: 70,
  cameraZoom: 1,
  color1: '#94ffd1',
  color2: '#6bf5ff',
  color3: '#ffffff',
  destination: 'onCanvas',
  embedMode: 'off',
  envPreset: 'city',
  format: 'gif',
  fov: 45,
  frameRate: 10,
  gizmoHelper: 'hide',
  grain: 'off',
  lightType: '3d',
  pixelDensity: 1,
  positionX: 0,
  positionY: 0.9,
  positionZ: -0.3,
  range: 'disabled',
  rangeEnd: 40,
  rangeStart: 0,
  reflection: 0.1,
  rotationX: 45,
  rotationY: 0,
  rotationZ: 0,
  shader: 'defaults',
  type: 'waterPlane',
  uAmplitude: 0,
  uDensity: 1.2,
  uFrequency: 0,
  uSpeed: 0.2,
  uStrength: 3.4,
  uTime: 0,
  wireframe: false,
} as const;

/**
 * Where each value goes in @shadergradient/react 2.4.x (verified against its type
 * definitions and runtime source):
 *  - `pixelDensity`, `fov` are props of <ShaderGradientCanvas>.
 *  - `bgColor1`, `bgColor2` describe the background behind the canvas; the canvas is
 *    transparent, so the container is painted with that colour.
 *  - `axesHelper`, `gizmoHelper`, `destination`, `embedMode`, `format`, `frameRate`
 *    are settings of the shadergradient.co customiser / GIF exporter. The React
 *    component does not accept them (they are not in GradientT) and they have no
 *    effect on a live canvas, so they are recorded here but not passed.
 *  - `envPreset` only applies when `lightType` is "env"; with "3d" no HDR file is
 *    requested, which also means no third-party network request at runtime.
 *  - Everything else is passed to <ShaderGradient> unchanged.
 */
export const CANVAS_PROPS = {
  pixelDensity: SHADER_CONFIG.pixelDensity,
  fov: SHADER_CONFIG.fov,
} as const;

export const BACKGROUND_COLOR = SHADER_CONFIG.bgColor1;

export const GRADIENT_PROPS: GradientT = {
  control: 'props',
  animate: SHADER_CONFIG.animate,
  type: SHADER_CONFIG.type,
  shader: SHADER_CONFIG.shader,
  uTime: SHADER_CONFIG.uTime,
  uSpeed: SHADER_CONFIG.uSpeed,
  uStrength: SHADER_CONFIG.uStrength,
  uDensity: SHADER_CONFIG.uDensity,
  uFrequency: SHADER_CONFIG.uFrequency,
  uAmplitude: SHADER_CONFIG.uAmplitude,
  range: SHADER_CONFIG.range,
  rangeStart: SHADER_CONFIG.rangeStart,
  rangeEnd: SHADER_CONFIG.rangeEnd,
  positionX: SHADER_CONFIG.positionX,
  positionY: SHADER_CONFIG.positionY,
  positionZ: SHADER_CONFIG.positionZ,
  rotationX: SHADER_CONFIG.rotationX,
  rotationY: SHADER_CONFIG.rotationY,
  rotationZ: SHADER_CONFIG.rotationZ,
  color1: SHADER_CONFIG.color1,
  color2: SHADER_CONFIG.color2,
  color3: SHADER_CONFIG.color3,
  reflection: SHADER_CONFIG.reflection,
  wireframe: SHADER_CONFIG.wireframe,
  cAzimuthAngle: SHADER_CONFIG.cAzimuthAngle,
  cPolarAngle: SHADER_CONFIG.cPolarAngle,
  cDistance: SHADER_CONFIG.cDistance,
  cameraZoom: SHADER_CONFIG.cameraZoom,
  lightType: SHADER_CONFIG.lightType,
  brightness: SHADER_CONFIG.brightness,
  envPreset: SHADER_CONFIG.envPreset,
  grain: SHADER_CONFIG.grain,
};

export const EXPORT_ONLY_KEYS = ['axesHelper', 'gizmoHelper', 'destination', 'embedMode', 'format', 'frameRate'] as const;
