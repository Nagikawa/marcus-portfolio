"use client";

import { Mesh, Program, Renderer, Transform, Triangle } from "ogl";
import { useEffect, useRef, type ReactNode } from "react";

export type ShaderFlowProps = {
  className?: string;
  flowSpeed?: Float32Array;
  iterations?: number;
  scale?: number;
  brightness?: number;
  colorLowA?: Float32Array;
  colorHighA?: Float32Array;
  fadeRx?: number;
  fadeRy?: number;
  fadeCx?: number;
  fadeCy?: number;
};

// Full-screen triangle: pass clip-space xy through so every pixel is covered.
const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uResolution;     // canvas size in pixels
uniform float uTime;          // seconds since the effect started
uniform vec2 uFlowSpeed;      // how fast the two sine layers animate
uniform float uScale;         // zoom of the flow field
uniform float uTwist;         // how strongly we slide along isolines (curl)
uniform float uDivergence;    // how strongly we slide along the gradient
uniform float uMeanderSpeed;  // speed of the slow circular drift
uniform float uBrightness;    // color multiplier
uniform int uIterations;      // how many times we walk the field (capped at 24)
uniform vec3 uColorLow;       // color where the gradient is weak (calm)
uniform vec3 uColorHigh;      // color where the gradient is strong (busy)
uniform vec3 uBgColor;        // page background, used at the fade edge
uniform vec4 uFadeShape;      // ellipse: (centerX, centerY, radiusX, radiusY)

// Cheap 2D "height" field: two nested sines, animated over time.
// The value is not used as color — only its slope (gradient) drives the flow.
float heightField(vec2 samplePoint) {
  float layerA = sin(samplePoint.x + sin(samplePoint.y + uTime * uFlowSpeed.x));
  float layerB = sin(samplePoint.y * samplePoint.x * 0.1 + uTime * uFlowSpeed.y);
  return layerA * layerB;
}

// Smoothstep from 1 at the ellipse center to 0 at and beyond the rim.
float fadeAlpha(float normalizedDistance) {
  float t = clamp(1.0 - normalizedDistance, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  // Pixel UV in 0..1
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Center the origin, then undo screen stretch so circles stay round.
  vec2 samplePoint = uv - 0.5;
  samplePoint.x *= uResolution.x / uResolution.y;

  // Zoom into the field (larger scale = tighter ripples).
  samplePoint *= uScale;

  // Slow circular offset so the whole field gently meanders.
  float meanderAngle = uTime * uMeanderSpeed * 0.1;
  vec2 meanderOffset = vec2(sin(meanderAngle), cos(meanderAngle)) * 0.1;

  // Twist = move perpendicular to the gradient (along isolines = swirl).
  // Divergence = move along the gradient (spread / gather).
  float twistAmount = uTwist * 0.01;
  float divergenceAmount = 1.0 / uDivergence;

  // Tiny step used for finite-difference derivatives of the height field.
  vec2 derivativeStep = vec2(0.05, 0.0);

  // Last estimated gradient; its length becomes the color mix later.
  vec2 gradient = vec2(0.0);

  // Walk the field: each step follows local curl + divergence + meander.
  // The loop bound is a compile-time constant; uIterations early-exits.
  for (int i = 0; i < 24; i++) {
    if (i >= uIterations) break;

    // Sample height at the current point and two neighbors (right, up).
    float heightHere = heightField(samplePoint);
    float heightRight = heightField(samplePoint + derivativeStep.xy);
    float heightUp = heightField(samplePoint + derivativeStep.yx);

    // Approximate ∇height, then scale it so the walk has visible motion.
    vec2 estimatedGradient = vec2(heightRight - heightHere, heightUp - heightHere) * 20.0;

    // Perpendicular of the gradient is the isoline tangent: (-gy, gx).
    vec2 isolineTangent = vec2(-estimatedGradient.y, estimatedGradient.x);

    samplePoint += isolineTangent * twistAmount
      + estimatedGradient * divergenceAmount
      + meanderOffset;

    gradient = estimatedGradient;
  }

  // Stronger local slope → brighter / warmer mix toward uColorHigh.
  float slopeMix = clamp(length(gradient) * 0.5, 0.0, 1.0);
  vec3 flowColor = mix(uColorLow, uColorHigh, slopeMix) * uBrightness;

  // CSS-style Y (top = 0) for the elliptical vignette.
  vec2 fadeUv = vec2(uv.x, 1.0 - uv.y);
  float aspect = uResolution.x / uResolution.y;

  // Distance from fade center, stretched into an ellipse and aspect-corrected.
  float fadeDx = ((fadeUv.x - uFadeShape.x) * aspect) / uFadeShape.z;
  float fadeDy = (fadeUv.y - uFadeShape.y) / uFadeShape.w;
  float fadeDistance = sqrt(fadeDx * fadeDx + fadeDy * fadeDy);
  float fadeMask = fadeAlpha(fadeDistance);

  // Outside the ellipse, blend toward the page background.
  vec3 outColor = mix(uBgColor, flowColor, fadeMask);
  gl_FragColor = vec4(outColor, 1.0);
}
`;

const DEFAULTS = {
  flowSpeed: new Float32Array([0.1, 0.2]),
  iterations: 14,
  scale: 6,
  brightness: 1,
  colorLowA: new Float32Array([0.18, 0.2, 0.3]),
  colorHighA: new Float32Array([0.55, 0.38, 0.32]),
  fadeRx: 1.8,
  fadeRy: 1.4,
  fadeCx: 0.5,
  fadeCy: 0.5,
};

function parseColor(input: string): Float32Array | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }
    if (hex.length !== 6) return null;
    const packed = parseInt(hex, 16);
    if (Number.isNaN(packed)) return null;
    return new Float32Array([
      ((packed >> 16) & 255) / 255,
      ((packed >> 8) & 255) / 255,
      (packed & 255) / 255,
    ]);
  }
  const channels = trimmed.match(/(\d+(?:\.\d+)?)/g);
  if (!channels || channels.length < 3) return null;
  return new Float32Array([
    Number(channels[0]) / 255,
    Number(channels[1]) / 255,
    Number(channels[2]) / 255,
  ]);
}

function readBgColor(element: HTMLElement): Float32Array {
  const styles = getComputedStyle(element);
  const cssVariable = styles.getPropertyValue("--background").trim();
  const fromVariable = cssVariable ? parseColor(cssVariable) : null;
  if (fromVariable) return fromVariable;

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;width:0;height:0;background:var(--background);";
  element.appendChild(probe);
  const computedBackground = getComputedStyle(probe).backgroundColor;
  element.removeChild(probe);
  return parseColor(computedBackground) ?? new Float32Array([1, 1, 1]);
}

export function ShaderFlow(props: ShaderFlowProps): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 1),
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    const gl = renderer.gl;
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([1, 1]) },
        uFlowSpeed: { value: new Float32Array([...DEFAULTS.flowSpeed]) },
        uScale: { value: DEFAULTS.scale },
        uTwist: { value: 50 },
        uDivergence: { value: 200 },
        uMeanderSpeed: { value: 2.5 },
        uBrightness: { value: DEFAULTS.brightness },
        uIterations: { value: DEFAULTS.iterations },
        uColorLow: { value: new Float32Array([...DEFAULTS.colorLowA]) },
        uColorHigh: { value: new Float32Array([...DEFAULTS.colorHighA]) },
        uBgColor: { value: readBgColor(document.documentElement) },
        uFadeShape: {
          value: [DEFAULTS.fadeCx, DEFAULTS.fadeCy, DEFAULTS.fadeRx, DEFAULTS.fadeRy],
        },
      },
    });

    if (!program.uniformLocations) {
      console.error("Shader link failed", {
        vertexLog: gl.getShaderInfoLog(program.vertexShader),
        fragmentLog: gl.getShaderInfoLog(program.fragmentShader),
      });
      return;
    }

    const mesh = new Mesh(gl, { geometry, program });
    const scene = new Transform();
    mesh.setParent(scene);

    const onResize = (): void => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      ];
    };

    onResize();
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let animationFrameId = 0;
    let pageVisible = true;
    let onScreen = true;
    const startTime = performance.now();

    const onVisibilityChange = (): void => {
      pageVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
      },
      { rootMargin: "100px" }
    );
    intersectionObserver.observe(container);

    const syncBackground = (): void => {
      program.uniforms.uBgColor.value = readBgColor(document.documentElement);
    };
    const themeObserver = new MutationObserver(syncBackground);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    syncBackground();

    const syncProps = (): void => {
      const current = propsRef.current;
      program.uniforms.uFlowSpeed.value = [
        ...(current.flowSpeed ?? DEFAULTS.flowSpeed),
      ];
      program.uniforms.uScale.value = current.scale ?? DEFAULTS.scale;
      program.uniforms.uBrightness.value =
        current.brightness ?? DEFAULTS.brightness;
      program.uniforms.uIterations.value =
        current.iterations ?? DEFAULTS.iterations;
      program.uniforms.uColorLow.value = [
        ...(current.colorLowA ?? DEFAULTS.colorLowA),
      ];
      program.uniforms.uColorHigh.value = [
        ...(current.colorHighA ?? DEFAULTS.colorHighA),
      ];
      program.uniforms.uFadeShape.value = [
        current.fadeCx ?? DEFAULTS.fadeCx,
        current.fadeCy ?? DEFAULTS.fadeCy,
        current.fadeRx ?? DEFAULTS.fadeRx,
        current.fadeRy ?? DEFAULTS.fadeRy,
      ];
    };

    const tick = (): void => {
      if (pageVisible && onScreen) {
        program.uniforms.uTime.value = (performance.now() - startTime) / 1000;
        syncProps();
        renderer.render({ scene });
      }
      animationFrameId = requestAnimationFrame(tick);
    };
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={props.className ?? "absolute inset-0 h-full w-full grayscale"}
    />
  );
}
