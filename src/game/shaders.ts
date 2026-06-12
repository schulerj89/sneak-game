import * as THREE from 'three';

export function createFloorShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color('#111923') },
      lineColor: { value: new THREE.Color('#223449') },
      vignetteColor: { value: new THREE.Color('#03050a') },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 lineColor;
      uniform vec3 vignetteColor;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      float gridLine(vec2 value) {
        vec2 cell = abs(fract(value - 0.5) - 0.5) / fwidth(value);
        return 1.0 - min(min(cell.x, cell.y), 1.0);
      }

      void main() {
        float grid = gridLine(vWorldPosition.xz);
        float distanceFade = smoothstep(2.0, 9.5, length(vWorldPosition.xz));
        float hatch = sin((vWorldPosition.x + vWorldPosition.z) * 9.0) * 0.5 + 0.5;
        vec3 color = mix(baseColor, lineColor, grid * 0.38);
        color += hatch * 0.015;
        color = mix(color, vignetteColor, distanceFade * 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function createGoalBeaconMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      glowColor: { value: new THREE.Color('#8eff81') },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec2 vUv;

      void main() {
        float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float pulse = 0.45 + 0.55 * sin(vUv.y * 20.0);
        gl_FragColor = vec4(glowColor, edge * (0.22 + pulse * 0.1));
      }
    `,
  });
}

export function createContactShadowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
}

export function createVisionConeGeometry(range: number, angleDegrees: number): THREE.BufferGeometry {
  const segments = 32;
  const half = (angleDegrees * Math.PI) / 360;
  const vertices: number[] = [0, 0, 0];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = -half + (index / segments) * half * 2;
    vertices.push(Math.sin(angle) * range, 0, Math.cos(angle) * range);
    if (index > 0) {
      indices.push(0, index, index + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
