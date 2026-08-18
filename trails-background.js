(() => {
  const canvas = document.querySelector("#trail-background");
  const glowCanvas = document.querySelector("#trail-background-glow");
  if (!canvas || !glowCanvas) return;

  const context = canvas.getContext("2d");
  const glowContext = glowCanvas.getContext("2d");
  const viewport = { width: innerWidth, height: innerHeight };
  const coreColors = ["255,255,255", "216,255,62", "150,245,255"];
  const glowColors = ["150,245,255", "216,255,62", "255,150,50", "255,90,210"];
  const state = { speed: .72, flicker: .68, density: .45, scrollBoost: 0, lastScrollY: scrollY, seed: Math.random() * 1000, lastTime: 0, elapsed: 0, trailCycle: -1, resetTrails: true, particles: [] };

  function resizeCanvas() {
    viewport.width = innerWidth;
    viewport.height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const glowRatio = Math.min(ratio * .5, 1);
    glowCanvas.width = Math.floor(viewport.width * glowRatio);
    glowCanvas.height = Math.floor(viewport.height * glowRatio);
    glowContext.setTransform(glowRatio, 0, 0, glowRatio, 0, 0);
    glowContext.clearRect(0, 0, viewport.width, viewport.height);
    state.resetTrails = true;
  }

  function randomValue(index, time) {
    return (Math.sin(index * 12.9898 + time * 78.233 + state.seed * 4.137) * 43758.5453) % 1;
  }

  function trailNoise(value) {
    return Math.sin(value * 1.7 + Math.sin(value * .43) * 2.8) * .5 + Math.sin(value * .31) * .25;
  }

  function flickerValue(time, index) {
    const slow = Math.sin(time * 8.2 + index * 2.1) * .5 + .5;
    const pulse = Math.pow(Math.abs(Math.sin(time * 71 + index * 17.3)), 8);
    return 1 - state.flicker * (.08 + slow * .16 + pulse * .76);
  }

  function paintBase(time) {
    const { width, height } = viewport;
    const cycle = Math.floor(time / 20);
    const hardReset = state.resetTrails || cycle !== state.trailCycle;
    state.trailCycle = cycle;
    context.globalCompositeOperation = "source-over";
    context.fillStyle = hardReset ? "#020202" : "rgba(2,2,2,.065)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";

    const grainCount = Math.floor(width * height / 26000 * state.density);
    context.fillStyle = "rgba(255,255,255,.08)";
    for (let index = 0; index < grainCount; index += 1) {
      const grain = randomValue(index, time);
      if (grain > .56) context.fillRect(Math.abs(randomValue(index + 77, time)) * width, Math.abs(randomValue(index + 131, time)) * height, grain > .85 ? 2 : 1, 1);
    }

    const interferenceCount = 30 + Math.floor(state.density * 34);
    for (let index = 0; index < interferenceCount; index += 1) {
      const seed = state.seed + index * 19.3;
      const x = Math.abs(randomValue(index + 410, Math.floor(time * 7))) * width;
      const y = Math.abs(randomValue(index + 470, Math.floor(time * 7))) * height;
      const length = 10 + Math.abs(trailNoise(seed + time * 2)) * 52;
      const angle = Math.round(trailNoise(seed + Math.floor(time * 5)) * 8) * Math.PI / 8;
      const kink = trailNoise(seed + time * 3) * 9;
      context.strokeStyle = index % 7 === 0 ? "rgba(150,245,255,.09)" : index % 5 === 0 ? "rgba(216,255,62,.07)" : "rgba(255,255,255,.05)";
      context.lineWidth = .35 + Math.abs(trailNoise(seed)) * .45;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length * .52 + Math.cos(angle + Math.PI / 2) * kink, y + Math.sin(angle) * length * .52 + Math.sin(angle + Math.PI / 2) * kink);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();
    }
    state.resetTrails = false;
    return hardReset;
  }

  function drawBranch(target, startX, startY, angle, length, depth, alpha, seed, time, glow = false) {
    if (depth === 0 || length < 3) return;
    const segments = glow ? 4 : 4;
    let x = startX;
    let y = startY;
    let currentAngle = angle;
    target.beginPath();
    target.moveTo(x, y);
    for (let segment = 1; segment <= segments; segment += 1) {
      const progress = segment / segments;
      currentAngle += trailNoise((glow ? 1 : Math.floor(time * 12)) + seed * (glow ? 1 : 2.3) + segment) * (glow ? .38 + depth * .08 : .42);
      const bend = trailNoise((glow ? seed * 1.3 + segment * 4.1 + Math.floor(time * 6) : Math.floor(time * 8) + seed + segment)) * (glow ? (7 + depth * 4) * progress : progress * 9);
      x += Math.cos(currentAngle) * length / segments + Math.cos(currentAngle + Math.PI / 2) * bend;
      y += Math.sin(currentAngle) * length / segments + Math.sin(currentAngle + Math.PI / 2) * bend;
      target.lineTo(x, y);
    }
    const palette = glow ? glowColors : coreColors;
    const color = palette[Math.floor(Math.abs(seed)) % palette.length];
    const hot = (Math.sin(time * (glow ? 3 : 2.8) + seed) + 1) * .5;
    target.strokeStyle = `rgba(${color},${alpha * (glow ? 1 : .8 + hot * .2)})`;
    target.lineWidth = glow ? 2.2 + depth * 1.4 + Math.abs(trailNoise(seed + time * 2)) * 1.8 : Math.max(.45, depth * .48);
    target.stroke();
    if (depth <= 1) return;
    const spread = (glow ? .55 : .52) + Math.abs(trailNoise(seed * (glow ? 2.2 : 2.7) + Math.floor(time * (glow ? 1 : 5)))) * (glow ? .6 : .42);
    const branchLength = length * ((glow ? .32 : .26) + Math.abs(trailNoise(seed + Math.floor(time * (glow ? 3.1 : .1)))) * (glow ? .16 : .16));
    const point = glow ? .42 + Math.abs(trailNoise(seed + time * 3.1)) * .4 : 1;
    const branchX = startX + (x - startX) * point;
    const branchY = startY + (y - startY) * point;
    drawBranch(target, branchX, branchY, currentAngle - spread, branchLength, depth - 1, alpha * .66, seed + 4.7, time, glow);
    drawBranch(target, branchX, branchY, currentAngle + spread, branchLength * .8, depth - 1, alpha * .54, seed + 9.2, time, glow);
  }

  function createParticle(index) {
    const scale = Math.max(viewport.width, viewport.height);
    const seed = state.seed + index * 13.17;
    const angle = randomValue(index * 3.7 + 900, seed) * Math.PI * 2;
    return {
      x: Math.abs(randomValue(index * 5.3 + 971, seed)) * viewport.width,
      y: Math.abs(randomValue(index * 7.1 + 1053, seed)) * viewport.height,
      angle,
      course: angle,
      courseShift: 0,
      nextCourseShift: .45 + Math.abs(randomValue(index * 7.3 + 1123, seed)) * .9,
      speed: scale * (.08 + Math.abs(randomValue(index * 4.1 + 940, seed)) * .13),
      sharpness: .65 + Math.abs(randomValue(index * 2.9 + 1187, seed)) * .8,
      seed,
      life: 0,
      maxLife: 18 + Math.abs(randomValue(index * 8.4 + 1091, seed)) * 10,
      history: []
    };
  }

  function resetParticles() {
    const placements = [[.1, .18, .48], [.9, .2, 2.68], [.46, .88, -1.18]];
    state.particles = placements.map(([x, y, angle], index) => {
      const particle = createParticle(index);
      particle.x = viewport.width * x;
      particle.y = viewport.height * y;
      particle.angle = particle.course = angle;
      particle.life = 1.2 + index * .35;
      particle.history = [{ x: particle.x, y: particle.y }];
      return particle;
    });
  }

  function updateParticle(particle, time, delta) {
    if (particle.life >= particle.nextCourseShift) {
      particle.courseShift = Math.max(-.9, Math.min(.9, particle.courseShift + trailNoise(particle.seed + particle.life * 3.1) * .4));
      particle.nextCourseShift += .45 + Math.abs(trailNoise(particle.seed + particle.life)) * .95;
    }
    const bite = trailNoise(particle.seed * 1.7 + Math.floor(time * (4 + particle.sharpness * 3))) * (.42 + particle.sharpness * .58);
    particle.angle = particle.course + particle.courseShift + bite;
    const pulse = .72 + Math.pow(Math.abs(trailNoise(particle.seed * 2.9 + time * 4.6)), 2) * .7;
    particle.x += Math.cos(particle.angle) * particle.speed * pulse * delta;
    particle.y += Math.sin(particle.angle) * particle.speed * pulse * delta;
    particle.life += delta;
    particle.history.push({ x: particle.x, y: particle.y });
    const limit = 128 + Math.floor(state.density * 48);
    if (particle.history.length > limit) particle.history.shift();
    if (particle.x < -80 || particle.x > viewport.width + 80 || particle.y < -80 || particle.y > viewport.height + 80 || particle.life > particle.maxLife) Object.assign(particle, createParticle(Math.floor(Math.random() * 1000)));
  }

  function drawParticle(particle, time) {
    if (particle.history.length < 3) return;
    const pulse = Math.pow(Math.abs(Math.sin(time * 36 + particle.seed)), 10);
    const intensity = Math.max(.72, flickerValue(time, particle.seed)) * (.62 + Math.min(particle.life, 2) * .15) + pulse * .5;
    const colorRoll = Math.abs(trailNoise(particle.seed * 2.1 + time * .15));
    const color = colorRoll > .67 ? coreColors[2] : colorRoll > .35 ? coreColors[1] : coreColors[0];
    context.lineJoin = "miter";
    context.lineCap = "square";
    const last = particle.history[particle.history.length - 1];
    for (let point = 1; point < particle.history.length; point += 1) {
      const age = point / (particle.history.length - 1);
      const previous = particle.history[point - 1];
      const current = particle.history[point];
      const seed = particle.seed + point * 2.17;
      if (Math.abs(trailNoise(seed + Math.floor(time * 12))) < .13) continue;
      const angle = Math.atan2(current.y - previous.y, current.x - previous.x);
      const length = Math.hypot(current.x - previous.x, current.y - previous.y);
      const normal = trailNoise(seed + Math.floor(time * 7)) * (2.5 + particle.sharpness * 5) * age;
      const split = .32 + Math.abs(trailNoise(seed + point)) * .32;
      const midX = previous.x + (current.x - previous.x) * split + Math.cos(angle + Math.PI / 2) * normal;
      const midY = previous.y + (current.y - previous.y) * split + Math.sin(angle + Math.PI / 2) * normal;
      context.strokeStyle = `rgba(${color},${(.12 + age * .56) * intensity})`;
      context.lineWidth = .34 + age * (.5 + particle.sharpness * .62 + Math.abs(trailNoise(seed + time)) * 1.05);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(midX, midY);
      context.lineTo(current.x, current.y);
      context.stroke();
      if (length > 5 && point % 4 === 0) drawBranch(context, midX, midY, angle + trailNoise(seed) * .9, 10 + length * 1.5, 2, .11 * intensity, seed, time);
    }
    for (let branch = 0, count = 2 + Math.floor(Math.abs(trailNoise(particle.seed + time * .16)) * 2); branch < count; branch += 1) {
      const offset = (branch - (count - 1) / 2) * .64 + trailNoise(particle.seed + branch * 3.7 + time) * .28;
      drawBranch(context, last.x, last.y, particle.angle + offset, 24 + Math.abs(trailNoise(particle.seed * 2.4 + branch + time)) * 46, 2, .22 * intensity, particle.seed + branch * 4.3 + time * .2);
    }
    const headSize = 2 + Math.abs(trailNoise(particle.seed + time * 1.6)) * 3.8;
    context.shadowBlur = 15 + headSize * 2.2 + pulse * 10;
    context.shadowColor = `rgba(${color},${.8 * intensity})`;
    context.fillStyle = `rgba(${color},${Math.min(1, .98 * intensity)})`;
    context.save();
    context.translate(last.x, last.y);
    context.rotate(particle.angle);
    context.fillRect(-headSize * 1.4, -headSize * .35, headSize * 2.8, headSize * .7);
    context.restore();
    context.shadowBlur = 0;
  }

  function drawGlow(particle, time) {
    if (particle.history.length < 3) return;
    const pulse = Math.pow(Math.abs(Math.sin(time * 19 + particle.seed * 1.7)), 6);
    const glow = .008 + pulse * .018 + state.density * .006;
    const colorRoll = Math.abs(trailNoise(particle.seed * 1.9 + time * .11));
    const color = glowColors[colorRoll > .67 ? 0 : colorRoll > .34 ? 1 : 2];
    glowContext.globalCompositeOperation = "lighter";
    glowContext.lineJoin = "miter";
    glowContext.lineCap = "square";
    glowContext.strokeStyle = `rgba(${color},${glow})`;
    glowContext.lineWidth = 2.4 + pulse * 2.4;
    glowContext.beginPath();
    glowContext.moveTo(particle.history[0].x, particle.history[0].y);
    for (let point = 1; point < particle.history.length; point += 4) {
      const previous = particle.history[point - 1];
      const current = particle.history[point];
      const angle = Math.atan2(current.y - previous.y, current.x - previous.x);
      const warp = trailNoise(particle.seed + point * 1.83 + Math.floor(time * 5)) * (4 + point / particle.history.length * 13);
      glowContext.lineTo(current.x + Math.cos(angle + Math.PI / 2) * warp, current.y + Math.sin(angle + Math.PI / 2) * warp);
    }
    glowContext.stroke();
    if (particle.history.length < 24 || pulse < .025) return;
    const count = 4 + Math.floor(state.density * 2);
    for (let branch = 0; branch < count; branch += 1) {
      const index = Math.min(particle.history.length - 4, 10 + Math.floor(branch * Math.max(1, particle.history.length - 20) / Math.max(1, count - 1)));
      const origin = particle.history[index];
      const before = particle.history[Math.max(0, index - 3)];
      const angle = Math.atan2(origin.y - before.y, origin.x - before.x);
      const seed = particle.seed + branch * 17.4;
      const flash = Math.pow(Math.abs(Math.sin(time * 5.2 + seed)), 14);
      if (flash < .025) continue;
      drawBranch(glowContext, origin.x, origin.y, angle + trailNoise(seed + time * 1.8) * 1.7, 22 + Math.abs(trailNoise(seed + time)) * 54, 2, (.018 + flash * .18) * (1 + state.density * .35), seed, time, true);
    }
  }

  function drawFrame(timestamp) {
    const seconds = timestamp / 1000;
    if (!state.lastTime) state.lastTime = seconds;
    const delta = Math.min(seconds - state.lastTime, .05);
    state.lastTime = seconds;
    state.scrollBoost = Math.max(0, state.scrollBoost - delta * 2.4);
    const motion = 1 + state.scrollBoost * 2.4;
    if (!state.particles.length) resetParticles();
    if (state.elapsed === 0) state.resetTrails = true;
    state.elapsed += delta * state.speed * motion;
    const time = state.elapsed;
    const hardReset = paintBase(time);
    glowContext.globalCompositeOperation = "source-over";
    if (hardReset) glowContext.clearRect(0, 0, viewport.width, viewport.height);
    else { glowContext.fillStyle = "rgba(2,2,2,.24)"; glowContext.fillRect(0, 0, viewport.width, viewport.height); }
    for (const particle of state.particles) { updateParticle(particle, time, delta * motion); drawGlow(particle, time); drawParticle(particle, time); }
    requestAnimationFrame(drawFrame);
  }

  addEventListener("resize", resizeCanvas);
  addEventListener("scroll", () => {
    const distance = Math.abs(scrollY - state.lastScrollY);
    state.lastScrollY = scrollY;
    state.scrollBoost = Math.min(5, state.scrollBoost + Math.min(2.6, distance * .012));
  }, { passive: true });
  resizeCanvas();
  requestAnimationFrame(drawFrame);
})();
