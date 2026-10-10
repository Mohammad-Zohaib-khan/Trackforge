import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShaderBackground, resetWebGLProbe } from './ShaderBackground';
import { EXPORT_ONLY_KEYS, GRADIENT_PROPS, SHADER_CONFIG } from './shaderConfig';

vi.mock('./ShaderCanvas', () => ({ default: () => <div data-testid="shader-canvas" /> }));

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  resetWebGLProbe();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ShaderBackground', () => {
  it('uses the static fallback when WebGL is unavailable (jsdom has none)', () => {
    mockMatchMedia(false);
    render(<ShaderBackground mode="app" />);
    const layer = screen.getByTestId('app-background');
    expect(layer).toHaveAttribute('data-mode', 'static');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.className).toContain('pointer-events-none');
  });

  it('uses the static fallback when the user prefers reduced motion, even with WebGL', () => {
    mockMatchMedia(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as null);
    render(<ShaderBackground mode="hero" />);
    expect(screen.getByTestId('app-background')).toHaveAttribute('data-mode', 'static');
    expect(screen.queryByTestId('shader-canvas')).not.toBeInTheDocument();
  });

  it('renders the shader when WebGL is available and motion is allowed', async () => {
    mockMatchMedia(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as null);
    render(<ShaderBackground mode="hero" />);
    expect(screen.getByTestId('app-background')).toHaveAttribute('data-mode', 'shader');
    expect(await screen.findByTestId('shader-canvas')).toBeInTheDocument();
  });
});

describe('shader configuration', () => {
  it('passes every supplied visual parameter through unchanged', () => {
    for (const [key, value] of Object.entries(SHADER_CONFIG)) {
      if ((EXPORT_ONLY_KEYS as readonly string[]).includes(key)) continue;
      if (['bgColor1', 'bgColor2', 'pixelDensity', 'fov'].includes(key)) continue;
      expect(GRADIENT_PROPS[key as keyof typeof GRADIENT_PROPS], key).toBe(value);
    }
    expect(GRADIENT_PROPS.control).toBe('props');
  });
});
