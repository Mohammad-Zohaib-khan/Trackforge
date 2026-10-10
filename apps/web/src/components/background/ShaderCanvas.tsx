import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { CANVAS_PROPS, GRADIENT_PROPS } from './shaderConfig';

/**
 * The only module that imports three.js / ShaderGradient. Loaded lazily so the
 * GPU renderer and its ~700 kB of code never block first paint, and mounted once
 * for the whole app by <ShaderBackground>.
 */
export default function ShaderCanvas({ running }: { running: boolean }) {
  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0 }}
      pixelDensity={CANVAS_PROPS.pixelDensity}
      fov={CANVAS_PROPS.fov}
      pointerEvents="none"
      lazyLoad={false}
      powerPreference="low-power"
    >
      <ShaderGradient {...GRADIENT_PROPS} animate={running ? 'on' : 'off'} />
    </ShaderGradientCanvas>
  );
}
