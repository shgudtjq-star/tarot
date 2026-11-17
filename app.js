'use strict';

const byId = id => document.getElementById(id);
const canonical = document.querySelector('link[rel="canonical"]').href;
const modes = byId('modes');
const topics = byId('topics');
const deckChoices = [...document.querySelectorAll('.deck-choice')];
const result = byId('result');
const resultCards = byId('result-cards');
const storyDialog = byId('story-dialog');
const storyImage = byId('story-image');
const storyShare = byId('story-share');
const saveStory = byId('save-story');
const reviewForm = byId('review-form');
const reviewSubmit = reviewForm.querySelector('button[type="submit"]');
const datePrinter = new Intl.DateTimeFormat('ko-KR', {month:'long', day:'numeric', weekday:'long', timeZone:'Asia/Seoul'});
const positionLabels = ['지금의 흐름','놓치기 쉬운 점','다음 한 걸음'];
const colorLabels = {rose:'로즈', gold:'골드', sage:'세이지'};

let mode = 'three';
let topic = 'today';
let activeDate = dateInSeoul();
let reading = null;
let storyFile = null;
let storyUrl = '';
let toastTimer;

function tell(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3700);
}

function clearReading() {
  reading = null;
  result.hidden = true;
  deckChoices.forEach(button => button.setAttribute('aria-pressed', 'false'));
}

function updateDate() {
  const now = new Date();
  const stamp = dateInSeoul(now);
  if (stamp !== activeDate) clearReading();
  activeDate = stamp;
  byId('reading-date').textContent = datePrinter.format(now);
}

function pressed(group, dataKey, value) {
  group.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset[dataKey] === value));
  });
}

for (const [key,[label]] of Object.entries(TAEYANG_TOPICS)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.topic = key;
  button.textContent = label;
  button.setAttribute('aria-pressed', String(key === topic));
  topics.append(button);
}

modes.addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button || button.dataset.mode === mode) return;
  mode = button.dataset.mode;
  pressed(modes, 'mode', mode);
  byId('deck-note').textContent = mode === 'one' ? '한 색을 고르면 오늘의 한 장이 펼쳐져요.' : '한 색을 고르면 세 장이 펼쳐져요.';
  clearReading();
});
topics.addEventListener('click', event => {
  const button = event.target.closest('[data-topic]');
  if (!button || button.dataset.topic === topic) return;
  topic = button.dataset.topic;
  pressed(topics, 'topic', topic);
  clearReading();
});

function cardElement(card, position, message) {
  const row = document.createElement('article');
  row.className = 'reading-card';
  const art = document.createElement('div');
  art.className = 'mini-card';
  art.setAttribute('aria-hidden', 'true');
  const icon = document.createElement('span');
  const number = document.createElement('span');
  icon.textContent = card.symbol;
  number.textContent = card.number;
  art.append(icon, number);

  const copy = document.createElement('div');
  const label = document.createElement('p');
  const title = document.createElement('h4');
  const interpretation = document.createElement('p');
  label.className = 'card-position';
  label.textContent = position;
  title.textContent = card.name;
  interpretation.textContent = message;
  copy.append(label, title, interpretation);
  row.append(art, copy);
  return row;
}

function reveal(color) {
  updateDate();
  const cards = cardsFor(activeDate, topic, color, mode);
  const [label, lens, practical] = TAEYANG_TOPICS[topic];
  const lastCard = cards.at(-1);
  const messages = mode === 'one'
    ? [lens + ' ' + cards[0].signal]
    : [lens + ' ' + cards[0].signal, cards[1].caution, cards[2].action];
  const action = mode === 'one' ? lastCard.action + ' ' + practical : practical;
  const focusTitle = byId('result-title');

  reading = {cards, messages, label, action, date:activeDate, color};
  deckChoices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === color)));
  byId('result-topic').textContent = label + ' · ' + colorLabels[color] + ' · ' + (mode === 'one' ? '오늘 한 장' : '세 장 리딩');
  focusTitle.textContent = lastCard.quote;
  const question = byId('question-text').value.trim();
  const questionDisplay = byId('result-question');
  questionDisplay.hidden = !question;
  questionDisplay.textContent = question ? '“' + question + '”' : '';
  byId('result-action').textContent = action;
  resultCards.replaceChildren(...cards.map((card, i) => cardElement(card, mode === 'one' ? '오늘 만난 카드' : positionLabels[i], messages[i])));
  result.hidden = false;
  focusTitle.focus({preventScroll:true});
  result.scrollIntoView({block:'start'});
}
deckChoices.forEach(button => button.addEventListener('click', () => reveal(button.dataset.color)));
byId('return-to-deck').addEventListener('click', () => {
  const selected = deckChoices.find(button => button.getAttribute('aria-pressed') === 'true');
  clearReading();
  if (selected) selected.focus();
});
updateDate();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateDate();
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  const previous = document.activeElement;
  document.body.append(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch {}
  field.remove();
  previous?.focus({preventScroll:true});
  return copied;
}

byId('share-site').addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({title:'태양타로', text:'오늘 마음이 가는 카드 한 장을 골라보세요.', url:canonical});
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  tell(await copyText(canonical) ? '사이트 주소를 복사했어요.' : '주소창의 사이트 주소를 복사해 주세요.');
});

reviewForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = byId('review-name').value.trim();
  const message = byId('review-body').value.trim();
  const status = byId('review-status');
  if (!name || !message) {
    status.textContent = '별명과 후기를 모두 적어주세요.';
    return;
  }
  const copied = await copyText(['[태양타로 후기]', '별명 ' + name, '', message].join('\n'));
  status.textContent = copied ? '복사했어요. 채팅창을 열고 붙여넣어 보내주세요.' : '자동 복사가 안 됐어요. 입력한 문장을 직접 복사해 주세요.';
});
reviewSubmit.disabled = false;

async function loadReviews() {
  try {
    const response = await fetch('./reviews.json', {cache:'no-cache'});
    if (!response.ok) return;
    const reviews = await response.json();
    if (!Array.isArray(reviews)) return;
    const nodes = reviews.filter(item => item && typeof item.name === 'string' && typeof item.text === 'string' && item.name.trim() && item.text.trim()).map(item => {
      const review = document.createElement('article');
      const name = document.createElement('strong');
      const body = document.createElement('p');
      name.textContent = item.name;
      body.textContent = item.text;
      review.append(name, body);
      return review;
    });
    byId('review-list').replaceChildren(...nodes);
    byId('review-empty').hidden = nodes.length > 0;
  } catch {}
}
loadReviews();

function lineText(context, text, x, y, width, lineHeight) {
  let line = '';
  for (const ch of text) {
    if (line && context.measureText(line + ch).width > width) {
      context.fillText(line.trimEnd(), x, y);
      line = ch.trimStart();
      y += lineHeight;
    } else {
      line += ch;
    }
  }
  if (line) context.fillText(line, x, y);
}

function storyCanvasModel(data) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  const {width,height} = canvas;
  const sky = context.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, '#291a26');
  sky.addColorStop(.53, '#5a3444');
  sky.addColorStop(1, '#241925');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.lineWidth = 3;
  context.strokeStyle = '#eac889';
  context.strokeRect(43, 47, width - 86, height - 94);

  const hero = document.querySelector('.hero-image img');
  if (hero.complete && hero.naturalWidth) {
    const cropHeight = Math.floor(hero.naturalHeight * .87);
    context.drawImage(hero, 0, (hero.naturalHeight - cropHeight) / 2, hero.naturalWidth, cropHeight, 80, 262, 920, 627);
  }
  context.fillStyle = '#efcd91';
  context.textAlign = 'center';
  context.font = 'italic 74px Georgia, serif';
  context.fillText('Taeyang Tarot', 540, 157);
  context.fillStyle = '#fff0dd';
  context.font = '42px system-ui, sans-serif';
  context.fillText(data.date.replaceAll('-', '.') + ' · ' + data.label, 540, 225);
  context.fillStyle = '#f4d397';
  context.font = '94px Georgia, serif';
  context.fillText(data.cards.at(-1).symbol, 540, 1046);
  context.fillStyle = '#fff4e7';
  context.font = '700 49px system-ui, sans-serif';
  lineText(context, data.cards.at(-1).quote, 540, 1168, 800, 74);
  context.fillStyle = '#f0d7ce';
  context.font = '38px system-ui, sans-serif';
  lineText(context, data.cards.map(card => card.name).join('  ·  '), 540, 1408, 820, 61);
  context.fillStyle = '#eed19b';
  context.font = '700 46px system-ui, sans-serif';
  context.fillText('오늘, 마음이 가는 카드', 540, 1615);
  context.fillStyle = '#fff1df';
  context.font = '34px system-ui, sans-serif';
  context.fillText(new URL(canonical).hostname + '/sunlight-tarot/', 540, 1692);
  return canvas;
}

saveStory.addEventListener('click', () => {
  if (!reading) return;
  saveStory.disabled = true;
  try {
    storyCanvasModel(reading).toBlob(blob => {
      saveStory.disabled = false;
      if (!blob) { tell('이미지를 만들 수 없어요. 다시 눌러주세요.'); return; }
      if (storyUrl) URL.revokeObjectURL(storyUrl);
      storyUrl = URL.createObjectURL(blob);
      storyImage.src = storyUrl;
      byId('story-download').href = storyUrl;
      storyFile = typeof File === 'function' ? new File([blob], 'taeyang-tarot-story.png', {type:'image/png'}) : null;
      storyShare.hidden = !storyFile || !navigator.share || !navigator.canShare?.({files:[storyFile]});
      if (storyDialog.showModal) storyDialog.showModal();
      else storyDialog.setAttribute('open', '');
    }, 'image/png');
  } catch {
    saveStory.disabled = false;
    tell('이미지를 만들 수 없어요. 다시 눌러주세요.');
  }
});
storyShare.addEventListener('click', async () => {
  try { await navigator.share({files:[storyFile], title:'태양타로'}); }
  catch (error) { if (error.name !== 'AbortError') tell('이미지 다운로드를 이용해 주세요.'); }
});
byId('story-close').addEventListener('click', () => {
  if (storyDialog.close) storyDialog.close();
  else storyDialog.removeAttribute('open');
});

if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
  const welcomeVoice = byId('welcome-voice');
  const readingVoice = byId('reading-voice');
  const originals = new Map([[welcomeVoice, welcomeVoice.textContent], [readingVoice, readingVoice.textContent]]);
  let speakingButton;
  function say(text, button) {
    const wasSpeaking = speakingButton === button;
    const previous = speakingButton;
    if (previous) previous.textContent = originals.get(previous);
    speakingButton = null;
    speechSynthesis.cancel();
    if (wasSpeaking) return;
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'ko-KR';
    speech.rate = .93;
    const voices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('ko'));
    speech.voice = voices.find(voice => /Yuna|Heami|SunHi|선희/i.test(voice.name)) || voices[0] || null;
    speakingButton = button;
    button.textContent = '■ 듣기 멈추기';
    speech.onend = speech.onerror = () => {
      if (speakingButton !== button) return;
      speakingButton = null;
      button.textContent = originals.get(button);
    };
    speechSynthesis.speak(speech);
  }
  welcomeVoice.hidden = false;
  readingVoice.hidden = false;
  welcomeVoice.addEventListener('click', () => say('안녕하세요, 태양타로예요. 마음에 맴도는 질문이 있나요? 지금 가장 끌리는 색을 골라보세요. 카드가 들려주는 이야기와, 오늘 해볼 작은 한 가지를 함께 찾아요.', welcomeVoice));
  readingVoice.addEventListener('click', () => {
    if (reading) say([reading.label, ...reading.messages, '오늘 해볼 한 가지.', reading.action].join(' '), readingVoice);
  });
}
