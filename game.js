/* ============================================================
   此间处己·一室录  ——  游戏引擎
   ============================================================ */

const $ = (id) => document.getElementById(id);

/* ========== 状态 ========== */
const State = {
  playerName: '王晓宇',
  dormType: null,            // 'male' | 'female'
  currentScene: 'yuandai',
  pendingNext: null,       // 选完 quote 后的下一场景 id
  values: { 观己度: 0, 修身度: 0, 接物度: 0, 安命度: 0 },
  rels:   { 宋: 0, 李: 0, 秦: 0 },
  visited: [],             // {sceneId, label, tag, quote, src, branchLabel, eff, redirect}
  lineQueue: [],
  mute: false,
  sceneContext: 'cabinet',  // 当前在哪个事件
  isGameOver: false,        // 是否游戏已结束
  preSummaryScene: null     // 中途查看总结前的场景
};

/* ========== 工具 ========== */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function applyEffect(eff) {
  if (!eff) return;
  for (const k in eff) {
    if (k in State.values) State.values[k] = clamp(State.values[k] + eff[k], -10, 10);
    else if (k in State.rels) State.rels[k] = clamp(State.rels[k] + eff[k], -10, 10);
  }
  updateTopbar();
}

function updateTopbar() {
  // 顶栏不显示数值,保留空函数以兼容调用
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function showTopbar(yes) {
  $('topbar').classList.toggle('hidden', !yes);
}

function formatEffect(eff) {
  if (!eff) return '';
  const lines = [];
  const order = ['观己度', '修身度', '接物度', '安命度', '宋', '李', '秦'];
  for (const k of order) {
    if (eff[k]) {
      const sign = eff[k] > 0 ? '+' : '';
      const cls = eff[k] > 0 ? 'pos' : 'neg';
      lines.push(`<span class="eff-line"><b style="color:var(--wood)">${k}</b> <span class="${cls}">${sign}${eff[k]}</span></span>`);
    }
  }
  return lines.join('');
}

/* ========== 角色 → 图片映射 ========== */
const CHAR_IMG = {
  m: 'assets/fire_black.png',
  s: 'assets/fire_3.png',
  q: 'assets/fire_1.png',
  l: 'assets/fire_2.png'
};

/* ========== Meet 循环展示 ========== */
const MEET_ORDER = [
  {
    char: 's',
    name: '宋知扬',
    color: '#1e3a8a',
    personality: '骄傲要强 · 内心渴望被认可\n底色善良, 竞争前得失心重',
    blurb: '这是你高考分数最接近的同班同学。'
  },
  {
    char: 'q',
    name: '秦乐',
    color: '#c2700a',
    personality: '外向活泼 · 热心肠 · 情绪复原力强\n待人热烈真诚, 有时大大咧咧不过脑子',
    blurb: '他总在笑, 像宿舍里的小太阳。'
  },
  {
    char: 'l',
    name: '李念安',
    color: '#0a7d57',
    personality: '怯懦内敛 · 心思敏感 · 渴求集体接纳\n害怕被孤立, 常选择沉默退缩',
    blurb: '他说话声音很小, 像是怕打扰谁。'
  }
];
let meetIdx = 0;

function showMeetPerson() {
  const m = MEET_ORDER[meetIdx];
  $('meet-icon').src = CHAR_IMG[m.char];
  $('meet-name').textContent = m.name;
  $('meet-name').style.color = m.color;
  $('meet-personality').textContent = m.personality;
  $('meet-text').textContent = m.blurb;
  $('btn-meet-next').textContent = (meetIdx < MEET_ORDER.length - 1) ? '认识下一位 ▸' : '继续 ▸';
}

/* ========== 场景渲染：对话框(单行) ========== */
function applyGenderSub(s) {
  if (State.dormType === 'male') return s.replace(/她/g, '他');
  return s;
}
function renderLine(line) {
  let t = (line.t || '').replace(/主角/g, State.playerName || '我');
  t = applyGenderSub(t);
  if (line.c === 'n') {
    return `<div class="line"><span class="narrator">${t}</span></div>`;
  }
  return `<div class="line">${t}</div>`;
}

function renderSingleLine(line) {
  // 渲染单行 + 更新对话框顶部的 icon 和说话人
  const body = $('dialog-body');
  body.innerHTML = renderLine(line);
  body.scrollTop = body.scrollHeight;

  const icon = $('dialog-icon');
  const speaker = $('dialog-speaker');
  if (line.c === 'n' || !CHAR_IMG[line.c]) {
    icon.style.display = 'none';
    speaker.style.display = 'none';
  } else {
    icon.style.display = '';
    icon.src = CHAR_IMG[line.c];
    speaker.style.display = '';
    speaker.textContent = (line.c === 'm')
      ? (State.playerName || '我')
      : CHARS[line.c].name;
    speaker.style.color = STICK_COLORS[line.c];
  }
}

function pushNextLine() {
  // 第一次推进时,把队列里所有行扁平化为一条一条
  if (!State.allLines) {
    State.allLines = [];
    while (State.lineQueue.length > 0) {
      const batch = State.lineQueue.shift();
      for (const l of batch) State.allLines.push(l);
    }
  }
  if (State.allLines.length === 0) {
    State.allLines = null;
    return false;
  }
  const line = State.allLines.shift();
  renderSingleLine(line);
  return true;
}

function resetLineQueue() {
  State.allLines = null;
}

/* ========== 火柴人渲染(旧 API 保留,内部走 PNG) ========== */
const STICK_COLORS = {
  m: '#1a1a1a',
  s: '#1e3a8a',
  q: '#c2700a',
  l: '#0a7d57'
};

/* ========== 场景：纯对话 ========== */
function runScene(sceneId) {
  const scene = SCENES[sceneId];
  if (!scene) { console.error('no scene', sceneId); return; }

  if (scene.type === 'ending') {
    return runEnding(sceneId, scene);
  }
  if (scene.type === 'summary') {
    return runSummary();
  }

  // 普通对话场景 / 选择场景
  show('screen-scene');
  showTopbar(true);
  $('dialog').classList.remove('hidden');
  $('dialog-header').classList.remove('hidden');
  $('choices').classList.add('hidden');

  // 背景图(scene.bg 优先,默认宿舍)
  const bgMap = { dorm: 'assets/dorm.png', library: 'assets/library.png' };
  const bgKey = scene.bg || 'dorm';
  $('scene-bg').style.backgroundImage = `url('${bgMap[bgKey] || bgMap.dorm}')`;

  // 行展开
  State.lineQueue = [];
  if (scene.setup) State.lineQueue.push(scene.setup);
  if (scene.lines) State.lineQueue.push(scene.lines);
  resetLineQueue();

  State.currentScene = sceneId;
  State.sceneContext = sceneId;

  // 进入第一行
  if (!pushNextLine()) {
    afterDialog();
    return;
  }

  $('btn-next').onclick = () => {
    if (pushNextLine()) return;
    afterDialog();
  };

  // 任意点击继续（排除按钮、选择层等交互元素）
  $('screen-scene').onclick = (e) => {
    if (e.target.closest('button, .choices, .topbar, #btn-mute')) return;
    $('btn-next').click();
  };
}

function afterDialog() {
  const scene = SCENES[State.currentScene];
  if (scene.type === 'choice') {
    showChoices(scene);
  } else if (scene.next) {
    // 是否是过渡到另一主线
    if (SCENES[scene.next]) {
      if (SCENES[scene.next].type === 'scene' || SCENES[scene.next].type === 'choice') {
        runScene(scene.next);
      } else {
        runScene(scene.next);
      }
    }
  }
}

/* ========== 选择层 ========== */
function showChoices(scene) {
  $('dialog').classList.add('hidden');
  $('dialog-header').classList.add('hidden');
  const wrap = $('choices');
  wrap.innerHTML = '';
  scene.choices.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn-choice';
    btn.innerHTML = `<b style="color:var(--seal-red)">${ch.label}.</b> ${applyGenderSub(ch.text)}`;
    btn.onclick = () => onPick(ch);
    wrap.appendChild(btn);
  });
  wrap.classList.remove('hidden');
}

function onPick(choice) {
  // 记录
  const record = {
    sceneId: State.currentScene,
    label: choice.label,
    tag: choice.tag,
    text: choice.text,
    quote: choice.quote,
    src: choice.src,
    insight: choice.insight,
    eff: choice.eff || {},
    branchLabel: choice.branchLabel || null,
    redirect: choice.redirect || null,
    result: choice.result || []
  };
  State.visited.push(record);
  State.pendingNext = choice.next;
  State.pendingRedirect = choice.redirect || null;

  // 应用数值
  applyEffect(choice.eff);

  // 先展示选择后的即时结果
  if (record.result && record.result.length) {
    State.lineQueue = [record.result];
    show('screen-scene');
    showTopbar(true);
    $('dialog').classList.remove('hidden');
    $('dialog-header').classList.remove('hidden');
    $('choices').classList.add('hidden');
    $('scene-bg').style.backgroundImage = "url('assets/dorm.png')";
    resetLineQueue();
    pushNextLine();
    $('btn-next').textContent = '继续 ▸';
    $('btn-next').onclick = () => {
      showQuote(record);
    };
  } else {
    showQuote(record);
  }
}

/* ========== 袁采原文/启示 ========== */
function showQuote(record) {
  show('screen-quote');
  $('quote-text').textContent = applyGenderSub(record.quote);
  $('insight-text').textContent = applyGenderSub(record.insight);

  const effEl = $('quote-effect');
  if (record.branchLabel) {
    effEl.innerHTML = `<span style="color:var(--seal-red);font-weight:700">→ ${applyGenderSub(record.branchLabel)}</span>`;
  } else if (record.redirect) {
    effEl.innerHTML = `<span style="color:var(--seal-red);font-weight:700">↪ ${applyGenderSub(record.redirect)}</span>`;
  } else {
    effEl.innerHTML = '';
  }

  $('btn-quote-next').onclick = () => {
    const next = State.pendingNext;
    State.pendingNext = null;
    if (next && SCENES[next]) {
      runScene(next);
    } else {
      runScene('summary');
    }
  };
}

/* ========== 结局 ========== */
function runEnding(sceneId, scene) {
  // 把结局本身当作一次访问记录
  State.visited.push({
    sceneId,
    label: '·结·',
    tag: '终',
    text: scene.label,
    quote: scene.quote,
    src: scene.src,
    insight: scene.insight,
    eff: {},
    branchLabel: null,
    redirect: null,
    ending: scene
  });

  State.isGameOver = true;
  // 跳总结
  setTimeout(() => runScene('summary'), 100);
}

/* ========== 总结 ========== */
function runSummary() {
  show('screen-summary');
  showTopbar(true);

  // 数值终态
  const valEl = $('summary-values');
  valEl.innerHTML = '';
  for (const k of DIMS) {
    const v = State.values[k];
    const pct = (Math.abs(v) / 10) * 50;  // 半条表示满
    const cls = v >= 0 ? 'pos' : 'neg';
    valEl.insertAdjacentHTML('beforeend', `
      <div class="summary-row">
        <span class="label">${k}</span>
        <div class="bar"><span class="${cls}" style="margin-left:${v >= 0 ? 50 : 50 - pct}%; width:${pct}%"></span></div>
        <span class="num">${v > 0 ? '+' + v : v}</span>
      </div>
    `);
  }

  // 好感
  const relEl = $('summary-rels');
  relEl.innerHTML = '';
  for (const k of RELS) {
    const v = State.rels[k];
    const pct = (Math.abs(v) / 10) * 50;
    const cls = v >= 0 ? 'pos' : 'neg';
    const nameMap = { '宋': '宋知扬', '李': '李念安', '秦': '秦乐' };
    relEl.insertAdjacentHTML('beforeend', `
      <div class="summary-row">
        <span class="label">${nameMap[k]}</span>
        <div class="bar"><span class="${cls}" style="margin-left:${v >= 0 ? 50 : 50 - pct}%; width:${pct}%"></span></div>
        <span class="num">${v > 0 ? '+' + v : v}</span>
      </div>
    `);
  }

  // 人格
  const lastEnd = State.visited.slice().reverse().find(v => v.ending);
  $('summary-arch').textContent = lastEnd ? lastEnd.ending.arch : '——';

  // 所历原文(不显示选过的选项,只列原文 + 出处 + 启示)
  const qEl = $('summary-quotes');
  qEl.innerHTML = '';
  for (const r of State.visited) {
    if (!r.quote) continue;
    qEl.insertAdjacentHTML('beforeend', `
      <li>
        <div style="color:var(--ink);font-size:15px">"${r.quote}"</div>
        <span class="src">—— ${r.src || ''}</span>
        <div style="margin-top:6px;color:var(--ink-soft)">${r.insight || ''}</div>
      </li>
    `);
  }

  // 一室之省
  $('summary-final').textContent = composeFinal();

  // 重玩 / 返回 / 退出按钮
  const replayBtn = $('btn-replay');
  const exitBtn = $('btn-exit');
  if (State.isGameOver) {
    replayBtn.textContent = '再历此室';
    replayBtn.onclick = () => {
      resetGame();
      show('screen-yuandai');
      showTopbar(false);
    };
    if (exitBtn) {
      exitBtn.textContent = '退出';
      exitBtn.style.display = '';
      exitBtn.onclick = () => {
        // 尝试关闭窗口;若失败则给出提示
        try { window.close(); } catch (e) {}
        // 兜底:提示用户关闭标签
        if (!window.closed) {
          $('screen-summary').innerHTML = '<div class="summary-wrap" style="text-align:center;color:var(--paper);padding-top:40vh"><h1 style="font-size:28px;letter-spacing:8px">多谢亲历</h1><p style="margin-top:20px;opacity:0.7">请关闭此标签即可。</p></div>';
        }
      };
    }
  } else {
    // 中途查看总结
    replayBtn.textContent = '返回继续';
    replayBtn.onclick = () => {
      if (State.preSummaryScene) {
        runScene(State.preSummaryScene);
      } else {
        runScene('dorm_arrive');
      }
    };
    if (exitBtn) exitBtn.style.display = 'none';
  }
}

function resetGame() {
  Object.assign(State, {
    dormType: null,
    currentScene: 'yuandai',
    pendingNext: null,
    values: { 观己度: 0, 修身度: 0, 接物度: 0, 安命度: 0 },
    rels: { 宋: 0, 李: 0, 秦: 0 },
    visited: [],
    lineQueue: [],
    sceneContext: 'cabinet',
    isGameOver: false,
    preSummaryScene: null
  });
  updateTopbar();
}

function composeFinal() {
  // 根据最终结局 + 数值生成一段总结
  const end = State.visited.slice().reverse().find(v => v.ending);
  const v = State.values;
  const r = State.rels;
  const arch = end ? end.ending.arch : '——';
  const label = end ? end.ending.label : '——';

  // 简版一室之省
  const lines = [];
  lines.push(`你此番经历一室，所历原文凡 ${State.visited.filter(x => x.quote).length} 条；`);
  lines.push(`终得「${label}」——${arch}。`);
  lines.push('');
  lines.push(`观己度以 ${v.观己度 >= 0 ? '+' : ''}${v.观己度}，${describeDim('观己度', v.观己度)}；`);
  lines.push(`修身度以 ${v.修身度 >= 0 ? '+' : ''}${v.修身度}，${describeDim('修身度', v.修身度)}；`);
  lines.push(`接物度以 ${v.接物度 >= 0 ? '+' : ''}${v.接物度}，${describeDim('接物度', v.接物度)}；`);
  lines.push(`安命度以 ${v.安命度 >= 0 ? '+' : ''}${v.安命度}，${describeDim('安命度', v.安命度)}。`);
  lines.push('');
  lines.push(`与宋知扬之交，以 ${r.宋 >= 0 ? '+' : ''}${r.宋} 收尾，${r.宋 >= 4 ? '已是朋友' : r.宋 >= 1 ? '印象尚可' : r.宋 <= -4 ? '心生隔阂' : '不冷不热'}；`);
  lines.push(`与李念安之交，以 ${r.李 >= 0 ? '+' : ''}${r.李} 收尾，${r.李 >= 4 ? '已是朋友' : r.李 >= 1 ? '印象尚可' : r.李 <= -4 ? '心生隔阂' : '不冷不热'}；`);
  lines.push(`与秦乐之交，以 ${r.秦 >= 0 ? '+' : ''}${r.秦} 收尾，${r.秦 >= 4 ? '已是朋友' : r.秦 >= 1 ? '印象尚可' : r.秦 <= -4 ? '心生隔阂' : '不冷不热'}。`);
  lines.push('');
  lines.push(endingFinalText(label));
  return lines.join('\n');
}

function describeDim(name, v) {
  if (v >= 4)  return '明';
  if (v >= 1)  return '稍明';
  if (v <= -4) return '甚昧';
  if (v <= -1) return '稍昧';
  return '中立';
}

function endingFinalText(label) {
  // 按结局生成有文采的总结
  const map = {
    '争而无止': '一室之中，原是修身之地。你却把它走成了较劲的战场。胜负未定之前，你便已输了。望你他日回看，能认得那个气喘吁吁的自己，问他一句：值得吗？',
    '守己自安': '你不与他人争锋，也不与天地争时。守住了自己，便守住了一室的安宁。袁采所谓"安分守心"，你已初窥其门。',
    '明己知止': '你知道自己的高低，知道与人的远近。知止而后能定，定而后能安。一室虽小，已是你观己的明镜。',
    '守己而和': '你守住了自己的路，也接住了别人的好意。守己而不孤，和人而不失己。这条路走得稳。',
    '守己待时': '你不急。你知道自己还在长。世间事多的是"来得及"，少的是"来得及"。你愿做一个来得及的人。',
    '守己相知': '守己不是关上门。你守住自己，又愿意让别人走进来。关系的松动，常从一句真话开始。',
    '学为己用': '你把建模变成了自己的选择，不再是因为宋知扬才学。别人的长处，到你这里，变成了自己的成长。',
    '各守其路': '你暂时放下建模，先回到自己的英语演讲上。你分得清什么是别人的路，什么是自己的路。',
    '取而未定': '你学到了，但还没把它变成自己的方向。有些东西拿到手里，还要再放一放，才知道它是不是你的。',
    '学以自足': '你自己慢慢补全建模，不再靠别人推着走。散落的知识，你一点点收进自己手里，这便是自立。',
    '学以旁通': '你把学到的方法用到了别处。没有被一条路困住，学到的东西反而活了起来。',
    '学以知困': '你终于肯把自己不会的地方摊开，请人指点。肯认不会，才真的会进步。'
  };
  return map[label] || '一室之省，悉录于此。愿你他日再读，能会心一笑。';
}

/* ========== 入口 ========== */
function start() {
  // 袁采开场
  show('screen-yuandai');
  showTopbar(false);

  $('screen-yuandai').onclick = () => {
    // 显示舍友登场(单人循环)
    meetIdx = 0;
    showMeetPerson();
    show('screen-meet');
    showTopbar(false);
  };

  // 舍友 → 下一位 / 命名
  $('btn-meet-next').onclick = () => {
    if (meetIdx < MEET_ORDER.length - 1) {
      meetIdx++;
      showMeetPerson();
    } else {
      show('screen-name');
      showTopbar(false);
      setTimeout(() => $('input-name').focus(), 100);
    }
  };

  // 命名 → 选择寝室
  $('btn-start').onclick = () => {
    const name = ($('input-name').value || '').trim() || '王晓宇';
    State.playerName = name;
    show('screen-dorm');
    showTopbar(false);
  };

  // 寝室选择 → 入舍
  $('btn-dorm-male').onclick = () => {
    State.dormType = 'male';
    runScene('dorm_arrive');
  };
  $('btn-dorm-female').onclick = () => {
    State.dormType = 'female';
    runScene('dorm_arrive');
  };

  // 重玩 (初始化时绑定)
  $('btn-replay').onclick = () => {
    resetGame();
    show('screen-yuandai');
    showTopbar(false);
  };

  // 静音
  $('btn-mute').onclick = () => {
    State.mute = !State.mute;
    $('btn-mute').textContent = State.mute ? '♪̸' : '♪';
    $('btn-mute').style.opacity = State.mute ? 0.3 : 0.7;
  };

  // 总结按钮
  $('btn-summary').onclick = () => {
    const summaryOpen = !$('screen-summary').classList.contains('hidden');
    if (summaryOpen && State.preSummaryScene) {
      // 再次点击"录"：收起总结，返回之前的场景
      runScene(State.preSummaryScene);
    } else {
      State.preSummaryScene = State.currentScene;
      runScene('summary');
    }
  };

  // 袁采问对（Coze 全屏浮层 toggle）
  $('btn-chat').onclick = () => {
    const overlay = $('chat-overlay');
    const frame = $('chat-iframe');
    if (!frame.dataset.loaded) {
      frame.src = 'https://t4px57smqs.coze.site/';
      frame.dataset.loaded = '1';
    }
    overlay.classList.remove('hidden');
  };
  $('btn-chat-close').onclick = () => {
    $('chat-overlay').classList.add('hidden');
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('chat-overlay').classList.contains('hidden')) {
      $('chat-overlay').classList.add('hidden');
    }
  });

  updateTopbar();
}

/* ========== 启动 ========== */
window.addEventListener('DOMContentLoaded', start);