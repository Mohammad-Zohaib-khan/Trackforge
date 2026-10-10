import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { BACKGROUND_COLOR } from './shaderConfig';
import { useEffectsPreference } from './effectsPreference';

const ShaderCanvas = lazy(() => import('./ShaderCanvas'));

export type BackgroundMode = 'hero' | 'app';

let webglSupport: boolean | null = null;

/** Probes WebGL once per page and immediately releases the probe context. */
function detectWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglSupport = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** Test hook: forget the cached probe result. */
export function resetWebGLProbe(): void {
  webglSupport = null;
}

class ShaderErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/**
 * One fixed, non-interactive layer behind the whole app.
 *  - Animated water plane when WebGL is available and motion is allowed.
 *  - Static CSS rendition of the same palette for reduced motion, no WebGL,
 *    a renderer error, or when the user turns effects off in Settings.
 *  - Animation pauses while the tab is hidden.
 * In "app" mode a scrim keeps the water visible only in the page horizon so
 * tables, forms and charts sit on near-opaque surfaces.
 */
export function ShaderBackground({ mode }: { mode: BackgroundMode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [effects] = useEffectsPreference();
  const visible = usePageVisible();
  // Probe only when the shader could actually be shown.
  const useShader = !prefersReducedMotion && effects === 'on' && detectWebGL();
  const fallback = <div className="water-fallback absolute inset-0" />;

  return (
    <div
      aria-hidden
      data-testid="app-background"
      data-mode={useShader ? 'shader' : 'static'}
      className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden"
      style={{ backgroundColor: BACKGROUND_COLOR }}
    >
      {useShader ? (
        <ShaderErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <ShaderCanvas running={visible} />
          </Suspense>
        </ShaderErrorBoundary>
      ) : (
        fallback
      )}
      <div
        className={cx(
          'absolute inset-0 transition-opacity duration-700',
          mode === 'hero'
            ? 'bg-[linear-gradient(90deg,rgb(3_6_5/0.82)_0%,rgb(3_6_5/0.55)_42%,rgb(3_6_5/0.12)_78%),linear-gradient(180deg,rgb(0_0_0/0.45)_0%,rgb(0_0_0/0)_32%)]'
            : 'bg-[linear-gradient(90deg,rgb(5_8_7/0.55)_0%,rgb(5_8_7/0.2)_60%,rgb(5_8_7/0)_100%),linear-gradient(180deg,rgb(5_8_7/0.45)_0px,rgb(5_8_7/0.62)_220px,rgb(5_8_7/0.95)_420px)]',
        )}
      />
    </div>
  );
}
