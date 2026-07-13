// Canvas spin-wheel. Each spin shows a random subset of players; whichever the
// pointer (top, 12 o'clock) lands on is the value applied to the current attribute.

class Wheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.segments = [];      // [{ player, label }]
    this.rotation = 0;       // radians
    this.spinning = false;
    this.colors = ['#1d3557','#e63946','#457b9d','#2a9d8f','#e9c46a',
                   '#f4a261','#6a4c93','#118ab2','#ef476f','#073b4c',
                   '#3a86ff','#fb5607'];
  }

  // segments: array of { player, label }
  setSegments(segments) {
    this.segments = segments;
    this.rotation = 0;
    this.draw();
  }

  draw() {
    const { ctx, canvas, segments, rotation } = this;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, r = Math.min(cx, cy) - 6;
    const n = segments.length;
    const arc = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < n; i++) {
      const start = rotation + i * arc;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label text, rotated along the slice.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(10, Math.min(15, 220 / n))}px "Trebuchet MS", sans-serif`;
      const label = segments[i].label;
      ctx.fillText(label, r - 12, 0);
      ctx.restore();
    }

    // Hub.
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#1d3557';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏀', cx, cy + 1);
  }

  // Spins to a random segment; resolves with that segment when it stops.
  spin() {
    return new Promise((resolve) => {
      if (this.spinning || this.segments.length === 0) return;
      this.spinning = true;

      const n = this.segments.length;
      const arc = (Math.PI * 2) / n;
      const winner = Math.floor(Math.random() * n);

      // Pointer sits at the top: angle -PI/2. We want the winner's mid-angle there.
      const pointer = -Math.PI / 2;
      const targetMid = pointer - (winner * arc + arc / 2);
      const turns = 5 + Math.floor(Math.random() * 3);
      const startRot = this.rotation % (Math.PI * 2);
      const endRot = targetMid - turns * Math.PI * 2;

      const duration = 4200;
      const t0 = performance.now();
      const easeOut = (t) => 1 - Math.pow(1 - t, 3.2);

      const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        this.rotation = startRot + (endRot - startRot) * easeOut(t);
        this.draw();
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          this.spinning = false;
          resolve(this.segments[winner]);
        }
      };
      requestAnimationFrame(frame);
    });
  }
}

// Pick `count` random distinct players from the roster for one wheel.
function randomSegments(roster, count, attrKey) {
  const pool = [...roster];
  const chosen = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen.map(player => ({
    player,
    value: player[attrKey],
    label: lastName(player.name),
  }));
}

function lastName(name) {
  const parts = name.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}
