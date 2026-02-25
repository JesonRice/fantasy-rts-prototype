// Phaser 3 简化 RTS 原型
// 说明：六个阵营（人类、精灵、兽人、死灵、恶魔、矮人）
// 功能：阵营选择 -> 单张地图 -> 单位生成（玩家/AI）-> 鼠标框选 + 右键下命令 -> 简易战斗/AI

// 防止右键弹出菜单（用于右键下命令）
window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

// 全局设置
const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

// 阵营配置（颜色用于占位图）
const FACTIONS = [
  { id: 'human', name: '人类', color: 0x4da6ff },
  { id: 'elf', name: '精灵', color: 0x8aff8a },
  { id: 'orc', name: '兽人', color: 0xff8a4d },
  { id: 'undead', name: '死灵', color: 0xbfbfbf },
  { id: 'demon', name: '恶魔', color: 0xff6aff },
  { id: 'dwarf', name: '矮人', color: 0xffde4d }
];

// 每个阵营的基础单位模板（近战、远程）
// 数值可后续微调
const UNIT_TEMPLATES = {
  melee: { hp: 100, dmg: 12, range: 20, speed: 60, attackRate: 800, size: 12 },
  ranged: { hp: 70, dmg: 8, range: 120, speed: 70, attackRate: 900, size: 10 }
};

// 根据阵营进行简单偏差（让各阵营有差异）
const FACTION_MODS = {
  human:   { melee: { hp:1.0, dmg:1.0, speed:1.0 }, ranged: { hp:1.0, dmg:1.0, speed:1.0 } },
  elf:     { melee: { hp:0.9, dmg:0.9, speed:1.2 }, ranged: { hp:0.9, dmg:1.1, speed:1.2 } },
  orc:     { melee: { hp:1.3, dmg:1.3, speed:0.85 }, ranged: { hp:1.1, dmg:1.0, speed:0.8 } },
  undead:  { melee: { hp:1.0, dmg:1.0, speed:0.95 }, ranged: { hp:0.8, dmg:0.9, speed:0.9 } },
  demon:   { melee: { hp:0.95, dmg:1.4, speed:1.05 }, ranged: { hp:0.85, dmg:1.25, speed:1.05 } },
  dwarf:   { melee: { hp:1.25, dmg:1.1, speed:0.8 }, ranged: { hp:1.1, dmg:1.0, speed:0.75 } }
};

// 游戏变量
let selectedFaction = null; // 玩家选择的阵营 id
let gameScene; // Phaser 场景引用（create 后赋值）
let infoEl = document.getElementById('info');
let restartBtn = document.getElementById('restart');

// Phaser 配置
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'phaser-game',
  backgroundColor: '#222222',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

// 工具：创建一个小方块纹理作为单位占位图（颜色为十六进制）
function createUnitTexture(scene, key, size, color) {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRect(0,0,size,size);
  g.lineStyle(1, 0x000000, 1);
  g.strokeRect(0,0,size,size);
  g.generateTexture(key, size, size);
  g.destroy();
}

// Scene: preload
function preload() {
  // 不需要外部资源，所有贴图动态生成
}

// Scene: create（包括简单的主菜单/阵营选择）
function create() {
  gameScene = this;

  // 先展示选择界面（简单按钮）
  showFactionSelection(this);
}

// 显示阵营选择（覆盖在 canvas 上方的 DOM）
function showFactionSelection(scene) {
  // 创建一个半透明的覆盖层（Phaser DOM 容器也可以，但这里用原生 DOM 以便快速实现）
  const cover = document.createElement('div');
  cover.id = 'faction-cover';
  Object.assign(cover.style, {
    position: 'absolute', left:0, top:40, width:'100%', height:'calc(100% - 40px)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
    background:'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6))'
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background:'#111', padding:'18px', borderRadius:'8px', border:'1px solid #333', minWidth:'520px',
    color:'#fff', textAlign:'center'
  });

  const title = document.createElement('h2');
  title.innerText = '选择你的阵营';
  box.appendChild(title);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-around';
  row.style.gap = '8px';
  row.style.marginTop = '12px';

  FACTIONS.forEach(f => {
    const btn = document.createElement('div');
    btn.className = 'faction-btn';
    btn.innerText = f.name;
    btn.style.background = '#0e0e0e';
    btn.style.border = `2px solid #222`;
    btn.style.color = '#fff';
    btn.style.padding = '8px 12px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
      selectedFaction = f.id;
      document.body.removeChild(cover);
      startGameWithFaction(scene, f.id);
    };
    btn.onmouseover = () => btn.style.filter = 'brightness(1.15)';
    btn.onmouseleave = () => btn.style.filter = '';
    row.appendChild(btn);
  });

  box.appendChild(row);
  const hint = document.createElement('div');
  hint.style.marginTop = '12px';
  hint.style.color = '#cfcfcf';
  hint.innerText = '本原型支持玩家与 AI 对战。单位以颜色方块表示，后续可替换为像素精灵。';
  box.appendChild(hint);

  cover.appendChild(box);
  document.body.appendChild(cover);
}

// 场景启动：初始化地图、单位纹理、UI、输入
function startGameWithFaction(scene, factionId) {
  // 清理以前场景（若有）
  scene.cameras.main.setBackgroundColor('#3a3a3a');

  // 创建占位纹理（每个阵营两种单位）
  FACTIONS.forEach(f => {
    createUnitTexture(scene, `${f.id}_melee`, UNIT_TEMPLATES.melee.size+2, f.color);
    createUnitTexture(scene, `${f.id}_ranged`, UNIT_TEMPLATES.ranged.size+2, f.color);
  });

  // 地图底色（简单格子）
  const mapGraphics = scene.add.graphics();
  mapGraphics.fillStyle(0x2b2b2b, 1);
  mapGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 在地图上绘制一些简单障碍（矩形）
  const obstacles = scene.physics.add.staticGroup();
  const obsList = [
    { x: GAME_WIDTH/2, y: GAME_HEIGHT/2, w: 200, h: 60 },
    { x: GAME_WIDTH/2 + 180, y: GAME_HEIGHT/2 - 120, w: 120, h: 40 },
    { x: GAME_WIDTH/2 - 220, y: GAME_HEIGHT/2 + 140, w: 160, h: 40 }
  ];
  obsList.forEach(o => {
    const rect = scene.add.rectangle(o.x, o.y, o.w, o.h, 0x444444).setStrokeStyle(2, 0x222222);
    obstacles.add(rect);
  });

  // 阵营基地位置（左/右）
  const leftBase = { x: 80, y: GAME_HEIGHT/2 };
  const rightBase = { x: GAME_WIDTH - 80, y: GAME_HEIGHT/2 };

  // 可视化基地
  const baseLeft = scene.add.rectangle(leftBase.x, leftBase.y, 64, 64, 0x6666ff).setStrokeStyle(3, 0x222222);
  const baseRight = scene.add.rectangle(rightBase.x, rightBase.y, 64, 64, 0xff6666).setStrokeStyle(3, 0x222222);

  // 单位组（物理启用）
  const unitsGroup = scene.physics.add.group();

  // 存储自定义单位对象（包含数据与逻辑）
  const units = [];

  // 选择与命令控制
  let selecting = false;
  let selectStart = { x:0, y:0 };
  let selectionRect; // Phaser Graphics
  let selectedUnits = [];

  // UI 显示当前阵营与单位统计
  infoEl.innerText = `你: ${getFactionName(factionId)}   AI: 随机阵营  |  单位: 0`;

  // 产生 AI 阵营（从剩余阵营里随机）
  const aiFaction = chooseAIFaction(factionId);
  console.log('AI 阵营:', aiFaction);
  infoEl.innerText = `你: ${getFactionName(factionId)}   AI: ${getFactionName(aiFaction)}`;

  // 产兵策略：双方定时产兵到各自基地附近
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 2500; // ms
  const MAX_UNITS_PER_SIDE = 14;

  // 计时与 AI 产兵
  scene.time.addEvent({
    delay: 1000, loop: true, callback: () => {
      // 每秒更新信息
      const playerCount = units.filter(u=>u.faction === factionId).length;
      const aiCount = units.filter(u=>u.faction === aiFaction).length;
      infoEl.innerText = `你: ${getFactionName(factionId)}(${playerCount})  AI: ${getFactionName(aiFaction)}(${aiCount})`;
    }
  });

  // 初始生成少量单位（双方）
  spawnUnit(scene, units, unitsGroup, factionId, 'melee', leftBase.x + 40, leftBase.y - 40);
  spawnUnit(scene, units, unitsGroup, factionId, 'ranged', leftBase.x - 40, leftBase.y + 40);
  spawnUnit(scene, units, unitsGroup, aiFaction, 'melee', rightBase.x - 40, rightBase.y - 40);
  spawnUnit(scene, units, unitsGroup, aiFaction, 'ranged', rightBase.x + 40, rightBase.y + 40);

  // 输入处理：左键 框选/点选，右键 下命令
  scene.input.on('pointerdown', (pointer) => {
    if (pointer.leftButtonDown()) {
      selecting = true;
      selectStart.x = pointer.x; selectStart.y = pointer.y;
      if (!selectionRect) {
        selectionRect = scene.add.graphics();
      }
    }
  });

  scene.input.on('pointerup', (pointer) => {
    if (pointer.leftButtonReleased()) {
      selecting = false;
      if (selectionRect) { selectionRect.clear(); }
      // 选择：点选或框选
      const dx = Math.abs(pointer.x - selectStart.x);
      const dy = Math.abs(pointer.y - selectStart.y);
      if (dx < 6 && dy < 6) {
        // 点击选择单个单位（若为己方）
        const clicked = units.find(u => u.sprite.getBounds().contains(pointer.x, pointer.y));
        if (clicked && clicked.faction === factionId) {
          selectedUnits = [clicked];
        } else {
          selectedUnits = [];
        }
      } else {
        // 框选（选择己方单位）
        const selRect = new Phaser.Geom.Rectangle(
          Math.min(selectStart.x, pointer.x),
          Math.min(selectStart.y, pointer.y),
          Math.abs(pointer.x - selectStart.x),
          Math.abs(pointer.y - selectStart.y)
        );
        selectedUnits = units.filter(u => {
          if (u.faction !== factionId) return false;
          return Phaser.Geom.Intersects.RectangleToRectangle(selRect, u.sprite.getBounds());
        });
      }
      // 标记选择（绘制简单高亮）
      updateUnitSelectionVisuals(units, selectedUnits);
    }

    // 右键下命令（pointer.event.button === 2）
    if (pointer.event && pointer.event.button === 2) {
      // 右键：若指向敌方单位，则攻击该单位；否则移动到位置
      const clickedEnemy = units.find(u => u.sprite.getBounds().contains(pointer.x, pointer.y) && u.faction !== factionId);
      if (clickedEnemy) {
        // 下攻击命令
        selectedUnits.forEach(u => {
          u.command = { type: 'attackUnit', target: clickedEnemy };
        });
      } else {
        // 下移动命令（移动到点）
        selectedUnits.forEach(u => {
          u.command = { type: 'move', x: pointer.x, y: pointer.y };
        });
      }
    }
  });

  // 游戏主循环 update 中会更新单位行为（见 scene.update）
  // 保存引用到 scene，方便 update 使用
  scene.registry.set('units', units);
  scene.registry.set('unitsGroup', unitsGroup);
  scene.registry.set('factionId', factionId);
  scene.registry.set('aiFaction', aiFaction);
  scene.registry.set('leftBase', leftBase);
  scene.registry.set('rightBase', rightBase);
  scene.registry.set('obstacles', obstacles);

  // 重设 Restart 按钮行为（回到选择）
  restartBtn.onclick = () => {
    // 简单 reload 页面以重置
    window.location.reload();
  };

  // AI 简单行为：定时产兵并指挥进攻
  scene.time.addEvent({
    delay: 800, loop: true, callback: () => {
      const playerCount = units.filter(u=>u.faction === factionId).length;
      const aiCount = units.filter(u=>u.faction === aiFaction).length;
      if (aiCount < MAX_UNITS_PER_SIDE) {
        // AI 交替产近战和远程
        const t = (Math.random() < 0.6) ? 'melee' : 'ranged';
        const sx = rightBase.x + Phaser.Math.Between(-20,20);
        const sy = rightBase.y + Phaser.Math.Between(-40,40);
        spawnUnit(scene, units, unitsGroup, aiFaction, t, sx, sy);
      }
      if (playerCount < MAX_UNITS_PER_SIDE/2 && Math.random() < 0.3) {
        // 玩家一侧也会偶尔自动补充友方中立单位（仅为示例，真正项目可去掉）
        const t = (Math.random() < 0.6) ? 'melee' : 'ranged';
        const sx = leftBase.x + Phaser.Math.Between(-20,20);
        const sy = leftBase.y + Phaser.Math.Between(-40,40);
        spawnUnit(scene, units, unitsGroup, factionId, t, sx, sy);
      }

      // AI 指令：找到最近敌人并命令进攻（每个 AI 单位）
      const allEnemies = units.filter(u=>u.faction !== aiFaction);
      const aiUnits = units.filter(u=>u.faction === aiFaction);
      aiUnits.forEach(au => {
        if (allEnemies.length === 0) {
          // 向玩家基地移动
          au.command = { type:'move', x: leftBase.x + Phaser.Math.Between(-10,10), y: leftBase.y + Phaser.Math.Between(-10,10) };
        } else {
          // 攻击最近敌人
          let nearest = null; let nd = 99999;
          allEnemies.forEach(e => {
            const d = Phaser.Math.Distance.Between(au.sprite.x, au.sprite.y, e.sprite.x, e.sprite.y);
            if (d < nd) { nd = d; nearest = e; }
          });
          if (nearest) {
            au.command = { type:'attackUnit', target: nearest };
          }
        }
      });
    }
  });

  // 碰撞：单位与障碍
  scene.physics.add.collider(unitsGroup, obstacles);

  // 将 units 存到 scene 的自定义字段，以便 update 使用
  scene.unitsData = units;
  scene.selectionRect = selectionRect;
  scene.selectedUnits = selectedUnits;
}

// Phaser update：每帧更新单位（移动/攻击）和选择框绘制
function update(time, delta) {
  if (!gameScene || !gameScene.unitsData) return;
  const scene = gameScene;
  const units = scene.unitsData;
  const obstacles = scene.registry.get('obstacles');

  // 绘制选择框（如果在拉框）
  if (scene.input.activePointer.isDown && scene.input.activePointer.leftButtonDown()) {
    if (scene.selectionRect) {
      scene.selectionRect.clear();
      scene.selectionRect.lineStyle(1, 0xffff00, 1);
      const p = scene.input.activePointer;
      const sx = scene.input.activePointer.downX;
      const sy = scene.input.activePointer.downY;
      const w = p.x - sx;
      const h = p.y - sy;
      scene.selectionRect.strokeRect(sx, sy, w, h);
    }
  }

  // 更新每个单位的逻辑
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    // 如果单位已死亡，移除
    if (u.hp <= 0) {
      // 播放简单消失效果
      u.sprite.destroy();
      if (u.hp <= 0) {
        // 从数组删除
        units.splice(i,1);
      }
      continue;
    }

    // 如果有攻击目标（单位），检查目标是否仍存活
    if (u.command && u.command.type === 'attackUnit') {
      const target = u.command.target;
      if (!target || target.hp <= 0) {
        u.command = null;
      }
    }

    // 攻击逻辑：如果有目标单位且在射程内，停止移动并攻击
    if (u.command && u.command.type === 'attackUnit') {
      const tgt = u.command.target;
      if (tgt && tgt.hp > 0) {
        const dist = Phaser.Math.Distance.Between(u.sprite.x, u.sprite.y, tgt.sprite.x, tgt.sprite.y);
        if (dist <= u.range) {
          // 在射程内，停止移动
          u.sprite.body.setVelocity(0,0);
          // 攻击周期
          if (!u._lastAttack || (time - u._lastAttack) >= u.attackRate) {
            u._lastAttack = time;
            // 伤害应用（简单：直接减血）
            tgt.hp -= u.dmg;
            // 受击视觉（闪烁）
            const originalTint = tgt.sprite.tintTopLeft;
            tgt.sprite.setTint(0xffffff);
            scene.time.addEvent({ delay:80, callback: ()=> tgt.sprite.clearTint() });
          }
        } else {
          // 不在射程，向目标移动
          scene.physics.moveToObject(u.sprite, tgt.sprite, u.speed);
        }
      } else {
        u.command = null;
        u.sprite.body.setVelocity(0,0);
      }
    } else if (u.command && u.command.type === 'move') {
      // 移动到目标点
      const dx = u.command.x - u.sprite.x;
      const dy = u.command.y - u.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        u.sprite.body.setVelocity(0,0);
        u.command = null;
      } else {
        const angle = Math.atan2(dy, dx);
        u.sprite.body.setVelocity(Math.cos(angle)*u.speed, Math.sin(angle)*u.speed);
      }
    } else {
      // 无命令：如果是 AI 单位，可做巡逻或追敌（简单实现：停止）
      u.sprite.body.setVelocity(0,0);
    }

    // 界面生命条更新（简单：在 sprite 上方画矩形）
    if (!u.hpBar) {
      u.hpBar = scene.add.graphics();
      u.hpBar.setDepth(10);
    }
    u.hpBar.clear();
    const barW = u.size;
    const barH = 4;
    const x = u.sprite.x - barW/2;
    const y = u.sprite.y - u.size/2 - 8;
    u.hpBar.fillStyle(0x333333, 1);
    u.hpBar.fillRect(x, y, barW, barH);
    const pct = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);
    u.hpBar.fillStyle(0xff3333, 1);
    u.hpBar.fillRect(x + 1, y + 1, (barW - 2) * pct, barH - 2);
  }

  // 胜负检测（若一方无单位，显示提示并停止 AI 产兵）
  const factionId = scene.registry.get('factionId');
  const aiFaction = scene.registry.get('aiFaction');
  const unitsLeft = scene.unitsData.filter(u=>u.faction === factionId).length;
  const unitsAI = scene.unitsData.filter(u=>u.faction === aiFaction).length;
  if (unitsLeft === 0 || unitsAI === 0) {
    // 显示胜负（用 DOM 覆盖）
    showEndResult(unitsLeft === 0 ? '你败北' : '你获胜');
    // 暂停场景（停止 update 行为）
    scene.scene.pause();
  }
}

// 显示比赛结束覆盖���
function showEndResult(text) {
  const cover = document.createElement('div');
  Object.assign(cover.style, {
    position: 'absolute', left:'0', top:'40px', width:'100%', height:'calc(100% - 40px)', zIndex:2000,
    display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)'
  });
  const box = document.createElement('div');
  Object.assign(box.style, { background:'#111', padding:'18px', color:'#fff', borderRadius:'6px', border:'1px solid #333' });
  const h = document.createElement('h2');
  h.innerText = text;
  box.appendChild(h);
  const btn = document.createElement('button');
  btn.innerText = '返回重来';
  btn.onclick = () => { window.location.reload(); };
  box.appendChild(btn);
  cover.appendChild(box);
  document.body.appendChild(cover);
}

// 生成单位函数（负责创建 sprite 与数据结构）
function spawnUnit(scene, unitsArr, group, factionId, type, x, y) {
  // 限制每方单位数量（防爆发）
  const cnt = unitsArr.filter(u=>u.faction === factionId).length;
  if (cnt >= 18) return null;

  const baseTemplate = UNIT_TEMPLATES[type];
  const mod = FACTION_MODS[factionId][type];

  const size = Math.round(baseTemplate.size * 1.0);
  const maxHp = Math.round(baseTemplate.hp * (mod.hp||1));
  const dmg = Math.round(baseTemplate.dmg * (mod.dmg||1));
  const speed = Math.round(baseTemplate.speed * (mod.speed||1));

  const key = `${factionId}_${type}`;
  // 精简：使用已经生成的方块贴图
  const sprite = scene.physics.add.image(x, y, key).setDepth(5);
  sprite.setDisplaySize(size+2, size+2);
  sprite.setCollideWorldBounds(true);
  sprite.body.setSize(size, size, true);

  const unit = {
    id: Phaser.Utils.String.UUID(),
    faction: factionId,
    type: type,
    sprite: sprite,
    hp: maxHp,
    maxHp: maxHp,
    dmg: dmg,
    range: baseTemplate.range,
    speed: speed,
    attackRate: baseTemplate.attackRate,
    size: size,
    command: null
  };

  unitsArr.push(unit);
  group.add(sprite);

  return unit;
}

// 更新单位选择的视觉高亮
function updateUnitSelectionVisuals(units, selected) {
  units.forEach(u => {
    if (selected.includes(u)) {
      u.sprite.setStrokeStyle(2, 0xffff00);
    } else {
      u.sprite.setStrokeStyle();
    }
  });
}

// 选择一个 AI 阵营（随机，且不与玩家相同）
function chooseAIFaction(playerFaction) {
  const ids = FACTIONS.map(f=>f.id).filter(id=>id !== playerFaction);
  return ids[Phaser.Math.Between(0, ids.length-1)];
}

// 获取阵营中文名
function getFactionName(id) {
  const f = FACTIONS.find(x => x.id === id);
  return f ? f.name : id;
}