import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObjectResources } from './threeDisposal';

describe('three disposal helpers', () => {
  it('disposes shared geometries, materials, and texture maps once', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map, normalMap });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeMap = vi.spyOn(map, 'dispose');
    const disposeNormalMap = vi.spyOn(normalMap, 'dispose');

    const stats = disposeObjectResources(group);

    expect(stats).toEqual({ geometries: 1, materials: 1, textures: 2 });
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeMap).toHaveBeenCalledOnce();
    expect(disposeNormalMap).toHaveBeenCalledOnce();
  });

  it('disposes shader uniform textures in cached GLB material trees', () => {
    const uniformTexture = new THREE.Texture();
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        baseMap: { value: uniformTexture },
      },
    });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaderMaterial));
    const disposeUniformTexture = vi.spyOn(uniformTexture, 'dispose');

    const stats = disposeObjectResources(group);

    expect(stats.textures).toBe(1);
    expect(disposeUniformTexture).toHaveBeenCalledOnce();
  });
});
