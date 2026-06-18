# Official Three.js Reference Notes

Use these official docs as source anchors when reviewing or changing Three.js code:

- WebGLRenderer docs: `https://threejs.org/docs/pages/WebGLRenderer.html`
  - Prefer `renderer.setAnimationLoop()` for the app loop because the docs recommend it for compatibility.
  - Use `renderer.info.render` and `renderer.info.memory` for draw-call, triangle, geometry, and texture instrumentation.
  - `setNodesHandler()` is the WebGLRenderer bridge for node materials; treat node work as advanced/future-facing.
- Object3D docs: `https://threejs.org/docs/pages/Object3D.html`
  - `frustumCulled` is on by default.
  - Layers affect camera visibility and can also filter ray intersections.
  - `matrixAutoUpdate` and `matrixWorldAutoUpdate` can be disabled for static objects if the app explicitly updates matrices.
  - `renderOrder` can override scene ordering, but opaque and transparent objects are still sorted separately.
- Layers docs: `https://threejs.org/docs/pages/Layers.html`
  - Layers are a 32-bit membership mask; objects render only when sharing a layer with the camera.
- InstancedMesh docs: `https://threejs.org/docs/pages/InstancedMesh.html`
  - Use instancing for many objects with the same geometry/material and different transforms.
  - After `setMatrixAt()` or `setColorAt()`, mark the respective instance attribute `needsUpdate`.
  - Recompute instanced bounds when instance transforms change and dispose unused instanced meshes.
- BufferGeometry docs: `https://threejs.org/docs/pages/BufferGeometry.html`
  - `dispose()` frees GPU resources when geometry is no longer used.
  - Geometry transforms such as `rotateX/Y/Z()` are intended as one-time operations, not animation-loop work.
- Material docs: `https://threejs.org/docs/pages/Material.html`
  - `dispose()` frees material GPU resources when no longer used.
  - `forceSinglePass` can reduce draw calls for double-sided transparent flat objects when the two-pass quality benefit is not needed.
  - `onBeforeCompile()` is WebGLRenderer-specific; docs point advanced customization toward the node material system.
- NodeMaterial docs: `https://threejs.org/docs/pages/NodeMaterial.html`
  - Node materials expose node properties for color, AO, depth, alpha, backdrop, shadow, and vertex setup. Use only when it fits the existing renderer/runtime.
