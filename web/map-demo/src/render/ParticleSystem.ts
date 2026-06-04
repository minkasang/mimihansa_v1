interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  type: "sparkle" | "leaf" | "firefly" | "dust";
}

export class ParticleSystem {
  particles: Particle[] = [];
  private maxParticles = 150;

  spawnParticle(x: number, y: number, type: Particle["type"]): void {
    if (this.particles.length >= this.maxParticles) return;

    const colors: Record<string, string[]> = {
      sparkle: ["#FFD700", "#FFF8DC", "#FFE4B5", "#FFEC8B"],
      leaf: ["#8B4513", "#D2691E", "#CD853F", "#DEB887", "#228B22"],
      firefly: ["#ADFF2F", "#7FFF00", "#9ACD32", "#32CD32"],
      dust: ["#F5F5DC", "#FFF8DC", "#FAEBD7", "#FFE4C4"],
    };

    const colorList = colors[type];
    const color = colorList[Math.floor(Math.random() * colorList.length)];

    let vx = 0, vy = 0, size = 2, life = 60;
    switch (type) {
      case "sparkle":
        vx = (Math.random() - 0.5) * 0.5;
        vy = -Math.random() * 0.5 - 0.2;
        size = 1 + Math.random() * 2;
        life = 30 + Math.random() * 30;
        break;
      case "leaf":
        vx = (Math.random() - 0.5) * 1.5;
        vy = Math.random() * 0.5 + 0.2;
        size = 2 + Math.random() * 3;
        life = 60 + Math.random() * 60;
        break;
      case "firefly":
        vx = (Math.random() - 0.5) * 0.8;
        vy = (Math.random() - 0.5) * 0.8;
        size = 2 + Math.random() * 2;
        life = 100 + Math.random() * 100;
        break;
      case "dust":
        vx = (Math.random() - 0.5) * 0.3;
        vy = -Math.random() * 0.2;
        size = 1 + Math.random() * 2;
        life = 40 + Math.random() * 40;
        break;
    }

    this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, type });
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.type === "leaf") {
        p.vx += Math.sin(Date.now() / 200 + p.y * 0.1) * 0.02;
      } else if (p.type === "firefly") {
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    for (const p of this.particles) {
      if (p.x < viewX - 20 || p.x > viewX + viewW + 20 || p.y < viewY - 20 || p.y > viewY + viewH + 20) continue;

      const progress = p.life / p.maxLife;
      const alpha = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

      ctx.globalAlpha = alpha;

      if (p.type === "sparkle") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5 * progress, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "leaf") {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Date.now() / 500 + p.x * 0.1);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      } else if (p.type === "firefly") {
        const glow = Math.sin(Date.now() / 200 + p.x) * 0.5 + 0.5;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "dust") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  spawnAmbientParticles(mapWidth: number, mapHeight: number): void {
    const time = Date.now() / 1000;
    if (Math.random() < 0.3) {
      const x = Math.random() * mapWidth * 32;
      const y = Math.random() * mapHeight * 32;
      this.spawnParticle(x, y, "leaf");
    }
    if (time % 24 > 18 || time % 24 < 6) {
      if (Math.random() < 0.2) {
        const x = Math.random() * mapWidth * 32;
        const y = Math.random() * mapHeight * 32;
        this.spawnParticle(x, y, "firefly");
      }
    }
    if (Math.random() < 0.1) {
      const x = Math.random() * mapWidth * 32;
      const y = Math.random() * mapHeight * 32;
      this.spawnParticle(x, y, "dust");
    }
  }
}
