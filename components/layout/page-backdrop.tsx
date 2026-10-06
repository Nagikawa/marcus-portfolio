import type { ReactNode } from "react";

import { ShaderFlow } from "../shaders/shader-flow";

export function PageBackdrop(): ReactNode {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
    >
      <div className="absolute inset-0 opaity-50 md:opacity-100">
        <ShaderFlow brightness={3} iterations={10} flowSpeed={new Float32Array([0, 0.1])} />
      </div>
    </div>
  );
}
