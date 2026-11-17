'use strict';

const tarotMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tarotPalettes = {
  rose: ['#ffcbdf', '#ff7fb1', '#ffe9af', '#ff9f83', '#fff9e5'],
  gold: ['#ffdb78', '#fff0ad', '#fca25e', '#e8b0f7', '#fff9e5'],
  sage: ['#d8ffce', '#88efcf', '#ffd676', '#a7caff', '#fff9e5']
};

function tarotFace(card) {
  const face = document.createElement('span');
  face.className = 'tarot-face';
  face.setAttribute('aria-hidden', 'true');
  const symbol = document.createElement('span');
  symbol.className = 'tarot-fallback';
  symbol.textContent = card.symbol;
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.addEventListener('error', () => { image.hidden = true; }, {once:true});
  const file = String(TAEYANG_DECK.indexOf(card)).padStart(2, '0');
  image.src = './assets/arcana/m' + file + '.webp';
  face.append(symbol, image);
  return face;
}

function tarotBack(color) {
  const back = document.querySelector('.deck-choice[data-color="' + color + '"] .card-back').cloneNode(true);
  back.classList.add('tarot-back');
  return back;
}

function tarotFireworks(layer, x, y, color, width, height, signal) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || signal.aborted) return;
  const ratio = Math.min(devicePixelRatio || 1, 1.75);
  canvas.className = 'tarot-fireworks';
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.scale(ratio, ratio);
  layer.prepend(canvas);

  const radius = Math.min(width * .48, height * .36, 395);
  const colors = tarotPalettes[color];
  const salvos = [[0, 0, 0, 66], [-.24, -.19, 90, 38], [.27, -.13, 170, 42]];
  const sparks = salvos.flatMap(([offsetX, offsetY, delay, count]) => Array.from({length:count}, (_, i) => {
    const angle = (i + Math.random() * .75) * Math.PI * 2 / count;
    const speed = radius * (.26 + Math.random() * .92);
    return {
      x:x + radius * offsetX, y:y + radius * offsetY, delay, life:520 + Math.random() * 430,
      dx:Math.cos(angle) * speed, dy:Math.sin(angle) * speed,
      size:1 + Math.random() * 3, tint:colors[i % colors.length], star:i % 6 === 0
    };
  }));
  const started = performance.now();
  let frame;

  function remove() {
    cancelAnimationFrame(frame);
    canvas.remove();
    signal.removeEventListener('abort', remove);
  }

  function draw(now) {
    const elapsed = now - started;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    for (const [offsetX, offsetY, delay] of salvos) {
      const progress = (elapsed - delay) / 600;
      if (progress < 0 || progress > 1) continue;
      context.globalAlpha = (1 - progress) ** 2 * .62;
      context.lineWidth = 2;
      context.strokeStyle = colors[0];
      context.beginPath();
      context.arc(x + radius * offsetX, y + radius * offsetY, radius * (.06 + progress * .85), 0, Math.PI * 2);
      context.stroke();
    }
    for (const spark of sparks) {
      const progress = (elapsed - spark.delay) / spark.life;
      if (progress < 0 || progress > 1) continue;
      const travel = 1 - (1 - progress) ** 2;
      const px = spark.x + spark.dx * travel;
      const py = spark.y + spark.dy * travel + 66 * progress ** 2;
      const trail = .16 * (1 - progress) + .03;
      context.globalAlpha = (1 - progress) ** .8;
      context.strokeStyle = spark.tint;
      context.lineWidth = spark.size * .8;
      context.beginPath();
      context.moveTo(px - spark.dx * trail, py - spark.dy * trail);
      context.lineTo(px, py);
      context.stroke();
      context.fillStyle = spark.tint;
      if (spark.star) {
        context.beginPath();
        context.moveTo(px, py - spark.size * 2.8);
        context.lineTo(px + spark.size * .7, py - spark.size * .7);
        context.lineTo(px + spark.size * 2.8, py);
        context.lineTo(px + spark.size * .7, py + spark.size * .7);
        context.lineTo(px, py + spark.size * 2.8);
        context.lineTo(px - spark.size * .7, py + spark.size * .7);
        context.lineTo(px - spark.size * 2.8, py);
        context.lineTo(px - spark.size * .7, py - spark.size * .7);
        context.fill();
      } else {
        context.fillRect(px - 1, py - 1, spark.size, spark.size);
      }
    }
    if (elapsed < 1140) frame = requestAnimationFrame(draw);
    else remove();
  }

  signal.addEventListener('abort', remove, {once:true});
  frame = requestAnimationFrame(draw);
}

async function animateTarotCard(slot, color, onReveal, signal) {
  if (signal.aborted) return;
  const rect = slot.getBoundingClientRect();
  if (tarotMotion.matches || !slot.animate || !rect.width) {
    onReveal();
    return;
  }

  const layer = document.createElement('div');
  layer.className = 'tarot-sequence';
  const veil = document.createElement('div');
  veil.className = 'tarot-veil';
  const proxy = document.createElement('div');
  proxy.className = 'tarot-proxy ' + color;
  const flip = slot.querySelector('.tarot-flip').cloneNode(true);
  proxy.append(flip);
  layer.append(veil, proxy);
  document.getElementById('reveal-fx').append(layer);

  const width = layer.clientWidth;
  const height = layer.clientHeight;
  const x = width / 2;
  const y = height * .47;
  const dx = x - rect.left - rect.width / 2;
  const dy = y - rect.top - rect.height / 2;
  const scale = Math.min(3.25, width * .58 / rect.width, height * .58 / rect.height);
  Object.assign(proxy.style, {
    width:rect.width + 'px', height:rect.height + 'px',
    left:rect.left + 'px', top:rect.top + 'px'
  });
  veil.style.setProperty('--burst-color', tarotPalettes[color][0]);
  veil.style.setProperty('--burst-y', y + 'px');
  const center = 'translate(' + dx + 'px,' + dy + 'px)';
  const movement = proxy.animate([
    {transform:'translate(0,0) scale(1)', offset:0, easing:'cubic-bezier(.12,.76,.2,1)'},
    {transform:center + ' scale(' + scale * 1.075 + ')', offset:.32, easing:'ease-out'},
    {transform:center + ' scale(' + scale + ')', offset:.48},
    {transform:center + ' scale(' + scale + ')', offset:.70, easing:'cubic-bezier(.5,0,.32,1)'},
    {transform:'translate(0,0) scale(1)', offset:1}
  ], {duration:1380, fill:'both'});
  const turning = flip.animate([
    {transform:'rotateY(0deg) rotate(-6deg)'},
    {transform:'rotateY(180deg) rotate(0deg)'}
  ], {duration:530, easing:'cubic-bezier(.41,.08,.18,1)', fill:'both'});
  const dim = veil.animate([
    {opacity:0}, {opacity:1, offset:.29}, {opacity:1, offset:.71}, {opacity:0}
  ], {duration:1380, fill:'both'});
  slot.classList.add('in-flight');
  const burst = setTimeout(() => {
    tarotFireworks(layer, x, y, color, width, height, signal);
    onReveal();
  }, 260);
  const cancel = () => {
    clearTimeout(burst);
    movement.cancel();
    turning.cancel();
    dim.cancel();
  };
  signal.addEventListener('abort', cancel, {once:true});
  try {
    await Promise.allSettled([movement.finished, turning.finished, dim.finished]);
  } finally {
    clearTimeout(burst);
    signal.removeEventListener('abort', cancel);
    slot.classList.remove('in-flight');
    layer.remove();
  }
}

let tarotAudio;
function prepareTarotAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return false;
  try {
    tarotAudio ??= new Audio();
    if (tarotAudio.state === 'suspended') tarotAudio.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function playTarotChime() {
  if (tarotAudio?.state !== 'running') return;
  const time = tarotAudio.currentTime;
  const notes = [659.25, 880, 1318.51, 1760];
  for (const [index, frequency] of notes.entries()) {
    const oscillator = tarotAudio.createOscillator();
    const volume = tarotAudio.createGain();
    const start = time + index * .055;
    oscillator.type = index === 0 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(.001, start);
    volume.gain.exponentialRampToValueAtTime(.12 - index * .02, start + .012);
    volume.gain.exponentialRampToValueAtTime(.001, start + .25);
    oscillator.connect(volume).connect(tarotAudio.destination);
    oscillator.start(start);
    oscillator.stop(start + .26);
  }
}
