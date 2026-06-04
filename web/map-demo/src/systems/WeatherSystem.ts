import { lerp } from "../utils/math";
import { 幸福镇地图 } from "../world/mapData";

// ==================== 天气系统 ====================
export type WeatherType = "clear" | "rain" | "snow" | "fog" | "cloudy" | "thunderstorm" | "sandstorm" | "rainbow" | "dusk_glow" | "windy";

export interface WeatherConfig {
  label: string;
  emoji: string;
  particleCount: number;
  overlayColor: string;
  overlayAlpha: number;
  hasLightning?: boolean;
  hasRainbow?: boolean;
  windStrength?: number;
  cloudTintR?: number;
  cloudTintG?: number;
  cloudTintB?: number;
  cloudAlphaMult?: number;
  cloudDensityMult?: number;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  clear: { label: "晴天", emoji: "☀️", particleCount: 0, overlayColor: "255,255,255", overlayAlpha: 0, cloudTintR: 1.0, cloudTintG: 1.0, cloudTintB: 1.0, cloudAlphaMult: 1.0, cloudDensityMult: 1.0 },
  rain: { label: "雨天", emoji: "🌧️", particleCount: 200, overlayColor: "60,70,90", overlayAlpha: 0.15, cloudTintR: 0.5, cloudTintG: 0.5, cloudTintB: 0.55, cloudAlphaMult: 0.8, cloudDensityMult: 1.3 },
  snow: { label: "雪天", emoji: "❄️", particleCount: 150, overlayColor: "220,230,240", overlayAlpha: 0.1, cloudTintR: 0.7, cloudTintG: 0.7, cloudTintB: 0.75, cloudAlphaMult: 0.9, cloudDensityMult: 1.5 },
  fog: { label: "雾天", emoji: "🌫️", particleCount: 0, overlayColor: "200,210,220", overlayAlpha: 0.4, cloudTintR: 0.6, cloudTintG: 0.6, cloudTintB: 0.65, cloudAlphaMult: 0.3, cloudDensityMult: 0.6 },
  cloudy: { label: "阴天", emoji: "☁️", particleCount: 0, overlayColor: "150,160,170", overlayAlpha: 0.2, cloudTintR: 0.45, cloudTintG: 0.45, cloudTintB: 0.5, cloudAlphaMult: 0.9, cloudDensityMult: 1.6 },
  thunderstorm: { label: "雷暴", emoji: "⛈️", particleCount: 250, overlayColor: "30,30,40", overlayAlpha: 0.35, hasLightning: true, cloudTintR: 0.2, cloudTintG: 0.2, cloudTintB: 0.25, cloudAlphaMult: 0.95, cloudDensityMult: 2.0 },
  sandstorm: { label: "沙尘", emoji: "🌪️", particleCount: 300, overlayColor: "194,178,128", overlayAlpha: 0.45, windStrength: 3, cloudTintR: 0.5, cloudTintG: 0.45, cloudTintB: 0.35, cloudAlphaMult: 0.4, cloudDensityMult: 0.5 },
  rainbow: { label: "彩虹", emoji: "🌈", particleCount: 40, overlayColor: "200,220,255", overlayAlpha: 0.05, hasRainbow: true, cloudTintR: 1.0, cloudTintG: 1.0, cloudTintB: 1.0, cloudAlphaMult: 0.7, cloudDensityMult: 0.6 },
  dusk_glow: { label: "晚霞", emoji: "🌅", particleCount: 25, overlayColor: "255,140,100", overlayAlpha: 0.15, cloudTintR: 1.0, cloudTintG: 0.7, cloudTintB: 0.5, cloudAlphaMult: 0.6, cloudDensityMult: 0.8 },
  windy: { label: "大风", emoji: "💨", particleCount: 100, overlayColor: "180,190,200", overlayAlpha: 0.1, windStrength: 2, cloudTintR: 0.7, cloudTintG: 0.7, cloudTintB: 0.75, cloudAlphaMult: 0.5, cloudDensityMult: 0.7 },
};

interface WeatherParticle {
  x: number; y: number; speed: number; size: number; opacity: number; drift: number;
  type: "rain" | "snow" | "sand" | "leaf" | "petal" | "sparkle" | "splash" | "puddle_glint" | "fog_blob" | "wind_line";
  rotation: number;
  rotSpeed: number;
  life?: number;
  maxLife?: number;
}

export interface LightningBolt {
  x: number; y: number; segments: Array<{ x: number; y: number }>;
  life: number; maxLife: number; width: number;
}

export class WeatherSystem {
  currentWeather: WeatherType = "clear";
  targetWeather: WeatherType = "clear";
  intensity = 0.5;
  transitionProgress = 1;
  isTransitioning = false;
  particles: WeatherParticle[] = [];
  screenShakeX = 0;
  screenShakeY = 0;
  private windX = 0;
  private lightningBolts: LightningBolt[] = [];
  private lightningTimer = 0;
  private nextLightningTime = Math.random() * 3000 + 2000;
  private rainbowPhase = 0;
  private fogBlobs: WeatherParticle[] = [];
  private puddleGlints: WeatherParticle[] = [];
  private shakeDecayX = 0;
  private shakeDecayY = 0;
  /** 主天气粒子数（避免每帧 filter 全数组） */
  private mainParticleCount = 0;
  private windLineCount = 0;

  setWeather(type: WeatherType, intensity = 0.5): void {
    if (type === this.currentWeather) return;
    if (this.isTransitioning && type === this.targetWeather) return;
    this.targetWeather = type;
    this.intensity = Math.max(0.1, Math.min(1, intensity));
    this.isTransitioning = true;
    this.transitionProgress = 0;
  }

  private finishTransition(): void {
    this.currentWeather = this.targetWeather;
    this.isTransitioning = false;
    this.transitionProgress = 1;
    this.lightningBolts = [];
  }

  private createParticle(weather: WeatherType): WeatherParticle {
    const w = 幸福镇地图.width * 32;
    const config = WEATHER_CONFIGS[weather];
    let type: WeatherParticle["type"] = "rain";
    let speed = 3;
    let size = 1;
    let drift = 0;

    switch (weather) {
      case "rain":
      case "thunderstorm":
        type = "rain";
        speed = 4 + Math.random() * 5;
        size = 1 + Math.random() * 1.5;
        drift = (Math.random() - 0.5) * 0.8 + (config.windStrength || 0) * 0.6;
        break;
      case "snow":
        type = "snow";
        speed = 0.5 + Math.random() * 1.5;
        size = 2 + Math.random() * 3;
        drift = (Math.random() - 0.5) * 1.5 + (config.windStrength || 0) * 0.5;
        break;
      case "sandstorm":
        type = "sand";
        speed = 1 + Math.random() * 2;
        size = 1 + Math.random() * 2;
        drift = (config.windStrength || 2) + Math.random() * 2;
        break;
      case "windy": {
        const types: WeatherParticle["type"][] = ["leaf", "petal", "sparkle"];
        type = types[Math.floor(Math.random() * types.length)];
        speed = 0.3 + Math.random() * 1;
        size = 2 + Math.random() * 3;
        drift = (config.windStrength || 1) + Math.random() * 3;
        break;
      }
      case "dusk_glow":
        type = "sparkle";
        speed = 0.2 + Math.random() * 0.5;
        size = 1 + Math.random() * 2;
        drift = (Math.random() - 0.5) * 0.3;
        break;
      case "rainbow":
        type = "sparkle";
        speed = 0.1 + Math.random() * 0.3;
        size = 1.5 + Math.random() * 2;
        drift = (Math.random() - 0.5) * 0.2;
        break;
      default:
        type = "sparkle";
        speed = 0.1;
        size = 1;
        drift = 0;
    }

    return {
      x: Math.random() * w,
      y: -10 - Math.random() * 50,
      speed,
      size,
      opacity: 0.3 + Math.random() * 0.5,
      drift,
      type,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
    };
  }

  private createSplash(x: number, y: number): WeatherParticle {
    return {
      x, y, speed: 0, size: 2 + Math.random() * 3,
      opacity: 0.6 + Math.random() * 0.3, drift: (Math.random() - 0.5) * 0.3,
      type: "splash", rotation: 0, rotSpeed: 0,
      life: 200 + Math.random() * 300, maxLife: 500,
    };
  }

  private createPuddleGlint(x: number, y: number): WeatherParticle {
    return {
      x, y, speed: 0, size: 3 + Math.random() * 5,
      opacity: 0, drift: 0,
      type: "puddle_glint", rotation: Math.random() * Math.PI * 2, rotSpeed: 0.02 + Math.random() * 0.03,
      life: 1500 + Math.random() * 3000, maxLife: 4500,
    };
  }

  private spawnLightning(): void {
    const w = 幸福镇地图.width * 32;
    const startX = Math.random() * w;
    const segments: Array<{ x: number; y: number }> = [{ x: startX, y: 0 }];
    let cx = startX;
    let cy = 0;
    let safety = 0;
    while (cy < 幸福镇地图.height * 32 && safety < 200) {
      cx += (Math.random() - 0.5) * 60;
      cy += 20 + Math.random() * 40;
      segments.push({ x: cx, y: cy });
      safety++;
    }
    this.lightningBolts.push({
      x: startX, y: 0, segments,
      life: 200, maxLife: 200, width: 2 + Math.random() * 3,
    });
    this.screenShakeX = (Math.random() - 0.5) * 8;
    this.screenShakeY = (Math.random() - 0.5) * 8;
    this.shakeDecayX = this.screenShakeX;
    this.shakeDecayY = this.screenShakeY;
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 50);

    if (this.isTransitioning) {
      this.transitionProgress += dt / 1200;
      if (this.transitionProgress >= 1) {
        this.finishTransition();
      }
    }

    const currentConfig = WEATHER_CONFIGS[this.currentWeather];
    const targetConfig = WEATHER_CONFIGS[this.targetWeather];

    const targetWind = targetConfig.windStrength || 0;
    const currentWind = currentConfig.windStrength || 0;
    const effectiveWind = this.isTransitioning
      ? lerp(currentWind, targetWind, this.transitionProgress)
      : targetWind;
    this.windX += (effectiveWind - this.windX) * 0.03;

    if (targetConfig.hasLightning && (!this.isTransitioning || this.transitionProgress > 0.3)) {
      this.lightningTimer += dt;
      if (this.lightningTimer >= this.nextLightningTime) {
        this.spawnLightning();
        this.lightningTimer = 0;
        this.nextLightningTime = Math.random() * 4000 + 1500;
      }
    }

    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      this.lightningBolts[i].life -= dt;
      if (this.lightningBolts[i].life <= 0) {
        this.lightningBolts.splice(i, 1);
      }
    }

    // 屏幕震动衰减
    if (Math.abs(this.shakeDecayX) > 0.1 || Math.abs(this.shakeDecayY) > 0.1) {
      this.screenShakeX = -this.shakeDecayX * 0.5;
      this.screenShakeY = -this.shakeDecayY * 0.5;
      this.shakeDecayX *= 0.85;
      this.shakeDecayY *= 0.85;
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
      this.shakeDecayX = 0;
      this.shakeDecayY = 0;
    }

    if (targetConfig.hasRainbow && (!this.isTransitioning || this.transitionProgress > 0.2)) {
      this.rainbowPhase += dt * 0.001;
    }

    const w = 幸福镇地图.width * 32;
    const h = 幸福镇地图.height * 32;
    const currentWeatherIsRain = this.currentWeather === "rain" || this.currentWeather === "thunderstorm";
    const targetWeatherIsRain = this.targetWeather === "rain" || this.targetWeather === "thunderstorm";
    const rainIntensity = this.isTransitioning
      ? (currentWeatherIsRain ? currentConfig.particleCount * (1 - this.transitionProgress) : 0)
        + (targetWeatherIsRain ? targetConfig.particleCount * this.transitionProgress : 0)
      : (currentWeatherIsRain ? currentConfig.particleCount : 0);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.speed * (dt / 16);
      p.x += p.drift + this.windX;
      p.rotation += p.rotSpeed * (dt / 16);

      if (p.type === "splash") {
        p.life = (p.life || 0) - dt;
        if ((p.life || 0) <= 0) { this.removeWeatherParticle(i); continue; }
        continue;
      }
      if (p.type === "puddle_glint") {
        p.life = (p.life || 0) - dt;
        p.opacity = 0.15 + Math.sin((p.maxLife || 0) * 0.003 + p.rotation) * 0.1;
        if ((p.life || 0) <= 0) { this.removeWeatherParticle(i); continue; }
        continue;
      }
      if (p.type === "fog_blob") {
        if (p.x > w + 200) p.x = -200;
        if (p.x < -200) p.x = w + 200;
        if (p.y > h + 200) p.y = -200;
        if (p.y < -200) p.y = h + 200;
        continue;
      }
      if (p.type === "wind_line") {
        p.x += p.drift * (dt / 16) + this.windX * 2;
        if (p.x > w + 100 || p.x < -100) { this.removeWeatherParticle(i); continue; }
        continue;
      }

      if (p.y > h + 20 || p.x < -50 || p.x > w + 50) {
        if (p.type === "rain" && p.y > h + 20 && rainIntensity > 50) {
          this.particles.push(this.createSplash(p.x - this.windX, h - Math.random() * 5));
          if (Math.random() < 0.15 && this.puddleGlints.length < 40) {
            this.puddleGlints.push(this.createPuddleGlint(p.x - this.windX, h - Math.random() * 5));
          }
        }
        this.removeWeatherParticle(i);
      }
    }

    // 更新雾团
    const isFog = targetConfig.overlayAlpha > 0.15 && targetConfig.particleCount === 0
      && targetConfig.hasLightning !== true && targetConfig.hasRainbow !== true && targetConfig.windStrength === undefined;
    const fogActive = this.isTransitioning
      ? (this.transitionProgress > 0.3 && isFog)
      : isFog;
    const fogTargetCount = fogActive ? 15 : 0;
    while (this.fogBlobs.length < fogTargetCount) {
      this.fogBlobs.push({
        x: Math.random() * w, y: Math.random() * h,
        speed: 0.1 + Math.random() * 0.3, size: 60 + Math.random() * 100,
        opacity: 0.08 + Math.random() * 0.12, drift: 0.05 + Math.random() * 0.15,
        type: "fog_blob", rotation: Math.random() * Math.PI * 2, rotSpeed: 0,
      });
    }
    while (this.fogBlobs.length > fogTargetCount) this.fogBlobs.pop();
    for (const fb of this.fogBlobs) {
      fb.x += fb.drift * (dt / 16) + this.windX * 0.3;
      fb.y += Math.sin(fb.rotation + Date.now() * 0.0003) * 0.3;
      fb.rotation += 0.002;
    }

    // 更新水洼光点
    for (let i = this.puddleGlints.length - 1; i >= 0; i--) {
      const pg = this.puddleGlints[i];
      pg.life = (pg.life || 0) - dt;
      pg.opacity = 0.05 + Math.sin((pg.maxLife || 0) * 0.005 + pg.rotation) * 0.08;
      if ((pg.life || 0) <= 0) { this.puddleGlints.splice(i, 1); }
    }

    const windLineTarget = effectiveWind > 1 ? Math.floor(effectiveWind * 3) : 0;
    while (this.windLineCount < windLineTarget) {
      this.particles.push({
        x: Math.random() * w, y: Math.random() * h,
        speed: 0, size: 20 + Math.random() * 30, opacity: 0.15 + Math.random() * 0.1,
        drift: -effectiveWind * 3 - Math.random() * 2, type: "wind_line",
        rotation: 0, rotSpeed: 0, life: 800 + Math.random() * 1200, maxLife: 2000,
      });
      this.windLineCount++;
    }

    let targetCount = 0;
    if (this.isTransitioning) {
      const startCount = Math.floor(currentConfig.particleCount * this.intensity);
      const endCount = Math.floor(targetConfig.particleCount * this.intensity);
      targetCount = Math.floor(lerp(startCount, endCount, this.transitionProgress));
    } else {
      targetCount = Math.floor(targetConfig.particleCount * this.intensity);
    }

    const spawnWeather = this.isTransitioning ? this.targetWeather : this.currentWeather;
    const maxSpawnPerFrame = 5;
    let spawned = 0;
    while (this.mainParticleCount < targetCount && spawned < maxSpawnPerFrame) {
      this.particles.push(this.createParticle(spawnWeather));
      this.mainParticleCount++;
      spawned++;
    }
  }

  private removeWeatherParticle(index: number): void {
    const p = this.particles[index];
    if (p.type === "wind_line") this.windLineCount--;
    else if (p.type !== "splash" && p.type !== "puddle_glint" && p.type !== "fog_blob") {
      this.mainParticleCount--;
    }
    this.particles.splice(index, 1);
  }

  draw(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    const currentConfig = WEATHER_CONFIGS[this.currentWeather];
    const targetConfig = WEATHER_CONFIGS[this.targetWeather];

    let overlayR = 0; let overlayG = 0; let overlayB = 0; let overlayA = 0;
    if (this.isTransitioning) {
      const t = this.transitionProgress;
      const [cr, cg, cb] = currentConfig.overlayColor.split(",").map(Number);
      const [tr, tg, tb] = targetConfig.overlayColor.split(",").map(Number);
      overlayR = lerp(cr, tr, t); overlayG = lerp(cg, tg, t); overlayB = lerp(cb, tb, t);
      overlayA = lerp(currentConfig.overlayAlpha, targetConfig.overlayAlpha, t);
    } else {
      const [r, g, b] = currentConfig.overlayColor.split(",").map(Number);
      overlayR = r; overlayG = g; overlayB = b; overlayA = currentConfig.overlayAlpha;
    }

    if (overlayA > 0.005) {
      ctx.fillStyle = `rgba(${Math.round(overlayR)},${Math.round(overlayG)},${Math.round(overlayB)},${overlayA})`;
      ctx.fillRect(viewX, viewY, viewW, viewH);
    }

    // 绘制雾团
    for (const fb of this.fogBlobs) {
      if (fb.x < viewX - 100 || fb.x > viewX + viewW + 100 || fb.y < viewY - 100 || fb.y > viewY + viewH + 100) continue;
      const gradient = ctx.createRadialGradient(fb.x, fb.y, 0, fb.x, fb.y, fb.size);
      gradient.addColorStop(0, `rgba(200,210,220,${fb.opacity})`);
      gradient.addColorStop(0.5, `rgba(190,200,210,${fb.opacity * 0.7})`);
      gradient.addColorStop(1, `rgba(180,190,200,0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2); ctx.fill();
    }

    // 绘制水洼光点
    for (const pg of this.puddleGlints) {
      if (pg.x < viewX - 20 || pg.x > viewX + viewW + 20 || pg.y < viewY - 20 || pg.y > viewY + viewH + 20) continue;
      ctx.strokeStyle = `rgba(150,180,220,${pg.opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pg.x, pg.y, pg.size, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(180,210,255,${pg.opacity * 0.4})`;
      ctx.fill();
    }

    if (targetConfig.hasRainbow && (!this.isTransitioning || this.transitionProgress > 0.15)) {
      const rainbowAlpha = this.isTransitioning ? Math.max(0, (this.transitionProgress - 0.15) / 0.85) : 1;
      ctx.save(); ctx.globalAlpha = rainbowAlpha;
      this.drawRainbow(ctx, viewX, viewY, viewW, viewH);
      ctx.restore();
    }

    for (const p of this.particles) {
      if (p.x < viewX - 80 || p.x > viewX + viewW + 80 || p.y < viewY - 80 || p.y > viewY + viewH + 80) continue;
      ctx.globalAlpha = p.opacity;
      switch (p.type) {
        case "rain":
          ctx.strokeStyle = "rgba(180, 200, 220, 0.6)";
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + this.windX * 2, p.y + p.speed * 2); ctx.stroke();
          break;
        case "snow":
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
          break;
        case "sand":
          ctx.fillStyle = "rgba(194, 178, 128, 0.7)";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case "leaf":
          ctx.fillStyle = `rgba(${60 + Math.sin(p.rotation) * 40}, ${120 + Math.cos(p.rotation) * 30}, 30, 0.7)`;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          break;
        case "petal":
          ctx.fillStyle = `rgba(255, ${180 + Math.sin(p.rotation) * 40}, ${180 + Math.cos(p.rotation) * 40}, 0.6)`;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          break;
        case "sparkle":
          ctx.fillStyle = `rgba(255, 220, 150, ${0.5 + Math.sin(p.rotation * 3) * 0.3})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case "splash": {
          const lifeRatio = (p.life || 0) / (p.maxLife || 1);
          ctx.fillStyle = `rgba(180, 200, 230, ${lifeRatio * 0.4})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - lifeRatio), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(180, 200, 230, ${lifeRatio * 0.5})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - lifeRatio) * 1.5, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "wind_line":
          ctx.strokeStyle = `rgba(200, 210, 220, ${p.opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.size, p.y); ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;

    for (const bolt of this.lightningBolts) {
      const alpha = bolt.life / bolt.maxLife;
      ctx.strokeStyle = `rgba(255, 255, 240, ${alpha})`;
      ctx.lineWidth = bolt.width;
      ctx.shadowColor = "rgba(255, 255, 200, 0.8)";
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
      for (let i = 1; i < bolt.segments.length; i++) ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.15})`;
      ctx.fillRect(viewX, viewY, viewW, viewH);
    }
  }

  private drawRainbow(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    const centerX = viewX + viewW * 0.5;
    const centerY = viewY + viewH * 0.8;
    const radius = Math.min(viewW, viewH) * 0.6;
    const colors = [
      "rgba(255, 0, 0, 0.3)", "rgba(255, 127, 0, 0.3)", "rgba(255, 255, 0, 0.3)",
      "rgba(0, 255, 0, 0.3)", "rgba(0, 0, 255, 0.3)", "rgba(75, 0, 130, 0.3)", "rgba(148, 0, 211, 0.3)",
    ];
    const pulse = 0.9 + Math.sin(this.rainbowPhase) * 0.1;
    for (let i = 0; i < colors.length; i++) {
      const r = radius - i * 8;
      ctx.strokeStyle = colors[i].replace("0.3", (0.25 * pulse).toFixed(2));
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(centerX, centerY, r * pulse, Math.PI, 0); ctx.stroke();
    }
  }

  getCurrentLabel(): string {
    const config = WEATHER_CONFIGS[this.isTransitioning ? this.targetWeather : this.currentWeather];
    return `${config.emoji} ${config.label}`;
  }
}

