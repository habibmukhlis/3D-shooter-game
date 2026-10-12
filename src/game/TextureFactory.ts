import * as THREE from 'three';

export class TextureFactory {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  public static getGroundTexture(): THREE.CanvasTexture {
    if (this.cache.has('ground')) return this.cache.get('ground')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark gravel / asphalt ground
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 512, 512);

    // Noise and pebbles
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const gray = Math.floor(25 + Math.random() * 30);
      ctx.fillStyle = `rgb(${gray}, ${gray + 2}, ${gray + 5})`;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    // Tire tracks & mud stains
    ctx.strokeStyle = '#181b1f';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(100, 0); ctx.lineTo(110, 512);
    ctx.moveTo(160, 0); ctx.lineTo(170, 512);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    this.cache.set('ground', texture);
    return texture;
  }

  public static getConcreteWallTexture(): THREE.CanvasTexture {
    if (this.cache.has('concrete')) return this.cache.get('concrete')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Weathered concrete slab
    ctx.fillStyle = '#4b5056';
    ctx.fillRect(0, 0, 512, 512);

    // Slab seams
    ctx.strokeStyle = '#2b2f33';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 504);
    ctx.beginPath();
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    // Noise & rain streaks
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const v = Math.floor(60 + Math.random() * 40);
      ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.2)`;
      ctx.fillRect(x, y, 3, 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 2);
    this.cache.set('concrete', texture);
    return texture;
  }

  public static getWarehouseMetalTexture(): THREE.CanvasTexture {
    if (this.cache.has('metal_sheet')) return this.cache.get('metal_sheet')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Corrugated olive green / slate military siding
    ctx.fillStyle = '#2f3b37';
    ctx.fillRect(0, 0, 256, 256);

    // Corrugation ridges
    for (let x = 0; x < 256; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#1c2421');
      grad.addColorStop(0.5, '#41524d');
      grad.addColorStop(1, '#1c2421');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 256);
    }

    // Rivets
    ctx.fillStyle = '#596b65';
    for (let y = 16; y < 256; y += 48) {
      for (let x = 8; x < 256; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 4);
    this.cache.set('metal_sheet', texture);
    return texture;
  }

  public static getCrateTexture(): THREE.CanvasTexture {
    if (this.cache.has('crate')) return this.cache.get('crate')!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Military olive wooden crate
    ctx.fillStyle = '#3d4a3e';
    ctx.fillRect(0, 0, 256, 256);

    // Border wooden planks
    ctx.fillStyle = '#2a342b';
    ctx.fillRect(0, 0, 256, 24);
    ctx.fillRect(0, 232, 256, 24);
    ctx.fillRect(0, 0, 24, 256);
    ctx.fillRect(232, 0, 24, 256);

    // Cross brace
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#2a342b';
    ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(236, 236);
    ctx.moveTo(236, 20); ctx.lineTo(20, 236);
    ctx.stroke();

    // Stenciled military marking
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('7.62x39mm', 128, 120);
    ctx.font = '14px monospace';
    ctx.fillText('СССР 1984', 128, 145);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('crate', texture);
    return texture;
  }

  public static getHelipadTexture(): THREE.CanvasTexture {
    if (this.cache.has('helipad')) return this.cache.get('helipad')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Concrete pad
    ctx.fillStyle = '#32373d';
    ctx.fillRect(0, 0, 512, 512);

    // Outer yellow circle
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.stroke();

    // Red inner ring
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, 170, 0, Math.PI * 2);
    ctx.stroke();

    // Big 'H'
    ctx.fillStyle = '#eab308';
    ctx.fillRect(170, 140, 28, 232);
    ctx.fillRect(314, 140, 28, 232);
    ctx.fillRect(170, 240, 172, 32);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('helipad', texture);
    return texture;
  }

  public static getDesertGroundTexture(): THREE.CanvasTexture {
    if (this.cache.has('desert_ground')) return this.cache.get('desert_ground')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Warm sand background
    ctx.fillStyle = '#b4916c';
    ctx.fillRect(0, 0, 512, 512);

    // Sand ripples
    for (let y = 0; y < 512; y += 16) {
      ctx.strokeStyle = '#9c7954';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(0) * 4);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, y + Math.sin(x * 0.05) * 6);
      }
      ctx.stroke();
    }

    // Sand noise
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(160 + Math.random() * 40);
      ctx.fillStyle = `rgb(${shade + 20}, ${shade}, ${shade - 30})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    this.cache.set('desert_ground', texture);
    return texture;
  }

  public static getMountainRockTexture(): THREE.CanvasTexture {
    if (this.cache.has('mountain_rock')) return this.cache.get('mountain_rock')!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Alpine granite rock
    ctx.fillStyle = '#33383f';
    ctx.fillRect(0, 0, 512, 512);

    // Granite fissures
    ctx.strokeStyle = '#1e2227';
    ctx.lineWidth = 3;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      let cx = Math.random() * 512;
      let cy = Math.random() * 512;
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 5; j++) {
        cx += (Math.random() - 0.5) * 60;
        cy += (Math.random() - 0.5) * 60;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Granite flecks & frost
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const g = Math.floor(40 + Math.random() * 60);
      ctx.fillStyle = `rgb(${g}, ${g + 4}, ${g + 8})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    this.cache.set('mountain_rock', texture);
    return texture;
  }
}
