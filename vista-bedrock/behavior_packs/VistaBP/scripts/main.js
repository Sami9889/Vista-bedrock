import { world, system, Player, Entity, Block, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

// ─────────────────────────────────────────────
// VISTA BEDROCK EDITION - Main Game Logic Script
// Features: TVs, Cassettes, Viewfinders, Mirrors,
//           Picture Tapes, Wave Gates
// ─────────────────────────────────────────────

const CHANNEL_MAP = {
  blue: "vista:cassette_blue", red: "vista:cassette_red",
  green: "vista:cassette_green", yellow: "vista:cassette_yellow",
  purple: "vista:cassette_purple", orange: "vista:cassette_orange",
  cyan: "vista:cassette_cyan", pink: "vista:cassette_pink",
  white: "vista:cassette_white", black: "vista:cassette_black",
  gray: "vista:cassette_gray", lime: "vista:cassette_lime",
  light_blue: "vista:cassette_light_blue", magenta: "vista:cassette_magenta",
  hollow: "vista:hollow_cassette"
};

// ── State Maps ──────────────────────────────────────────────────────────────
const TV_STATE = new Map();       // "x,y,z" -> { channel, powered, animTick, playing }
const VF_STATE = new Map();       // "x,y,z" -> { pitch, yaw, locked }
const PT_STATE = new Map();       // "x,y,z" -> { pictures: string[] }
const WAVE_URLS = new Map();      // "x,y,z" -> string url
const PLAYER_VF = new Map();      // player.id -> "x,y,z"
const VF_ANGLES = new Map();      // "playerId,x,y,z" -> { pitch, yaw }
const VF_LOCKED = new Map();      // "playerId,x,y,z" -> boolean
const BOUND_CASSETTES = new Map();// "x,y,z" (viewfinder) -> { cassette_id, channel }
const CAMERA_ENTS = new Map();    // "x,y,z" -> entity

// ── Helpers ─────────────────────────────────────────────────────────────────
function tvKey(pos) { return `${pos.x},${pos.y},${pos.z}`; }
function blockState(b, prop, val) {
  try { b.setProperty(prop, val); } catch(e) {}
}
function getChannelColor(ch) {
  const colors = {
    blue:"§9",red:"§c",green:"§a",yellow:"§e",purple:"§d",
    orange:"§6",cyan:"§b",pink:"§d",white:"§f",black:"§8",
    gray:"§7",lime:"§a",light_blue:"§b",magenta:"§d"
  };
  return colors[ch] || "§7";
}
function isCassette(itemId) {
  return Object.values(CHANNEL_MAP).includes(itemId);
}
function getCassetteChannel(itemId) {
  for (const [ch, id] of Object.entries(CHANNEL_MAP)) {
    if (id === itemId) return ch;
  }
  return null;
}

// ── TV Block Logic ───────────────────────────────────────────────────────────
function handleTVInteraction(player, block) {
  const held = player.getComponent("inventory").getItem(0);
  const itemId = held?.typeId;
  const pos = block.location;
  const key = tvKey(pos);
  let state = TV_STATE.get(key);
  if (!state) {
    state = { channel: "none", powered: false, animTick: 0, playing: false };
    TV_STATE.set(key, state);
  }

  if (itemId && isCassette(itemId)) {
    const ch = getCassetteChannel(itemId);
    if (ch === "hollow") {
      const vfKey = BOUND_CASSETTES.get(key);
      if (!vfKey) {
        player.sendMessage("§8This hollow cassette isn't bound to any Viewfinder.");
        return;
      }
      state.channel = "hollow";
      state.playing = true;
      blockState(block, "minecraft:channel", "hollow");
      blockState(block, "minecraft:display_layer", "on");
      player.sendMessage("§7Hollow cassette bound! Showing live viewfinder feed.");
      player.runCommandAsync("playsound note.pling @s ~~~");
    } else {
      state.channel = ch;
      state.playing = true;
      state.animTick = 0;
      blockState(block, "minecraft:channel", ch);
      blockState(block, "minecraft:display_layer", "on");
      const colorName = ch.replace("_", " ");
      player.sendMessage(`§7Now playing: ${getChannelColor(ch)}${colorName} Cassette`);
      player.runCommandAsync("playsound note.pling @s ~~~");
    }
    player.runCommandAsync(`clear @s ${itemId} 0 1`);
  } else if (itemId === "vista:picture_tape") {
    state.channel = "picture_tape";
    state.playing = true;
    blockState(block, "minecraft:channel", "picture_tape");
    blockState(block, "minecraft:display_layer", "on");
    PT_STATE.set(key, { pictures: [] });
    player.sendMessage("§6Picture Tape inserted! Right-click it to add map images.");
    player.runCommandAsync("playsound note.pling @s ~~~");
    player.runCommandAsync(`clear @s vista:picture_tape 0 1`);
  } else {
    player.sendMessage("§7Insert a cassette, picture tape or hollow cassette.");
  }
}

function startTVAnimation(player, block) {
  const key = tvKey(block.location);
  const state = TV_STATE.get(key);
  if (!state || !state.playing || state.channel === "none") return;
  const t = system.currentTick;
  if (t % 4 === 0) {
    state.animTick = (state.animTick + 1) % 40;
    if (state.channel === "hollow") {
      spawnCameraEntity(block);
    }
  }
}

function spawnCameraEntity(block) {
  const key = tvKey(block.location);
  let ent = CAMERA_ENTS.get(key);
  if (ent && ent.isValid) {
    try { ent.teleport(block.location.above(6)); } catch(e) {}
    return;
  }
  try {
    ent = block.dimension.spawnEntity("vista:camera_entity", block.location.above(6));
    ent.nameTag = "VistaCamera";
    CAMERA_ENTS.set(key, ent);
  } catch(e) {
    try {
      ent = world.getDimension("overworld").spawnEntity(
        "vista:camera_entity", block.location.above(6));
      ent.nameTag = "VistaCamera";
      CAMERA_ENTS.set(key, ent);
    } catch(e2) {}
  }
}

function onRedstoneChange(player, block) {
  const key = tvKey(block.location);
  const state = TV_STATE.get(key);
  if (!state) return;
  const powered = isGettingPower(block);
  state.powered = powered;
  if (powered) {
    blockState(block, "minecraft:display_layer", state.channel === "none" ? "off" : "on");
    if (state.playing) startTVAnimation(player, block);
  } else {
    blockState(block, "minecraft:display_layer", "off");
  }
}

function isGettingPower(block) {
  const dirs = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }
  ];
  for (const d of dirs) {
    try {
      const nb = block.dimension.getBlock({
        x: block.x + d.x, y: block.y + d.y, z: block.z + d.z
      });
      if (nb.getRedstonePower() > 0) return true;
    } catch(e) {}
  }
  return false;
}

// ── Viewfinder Logic ─────────────────────────────────────────────────────────
function handleViewfinderInteraction(player, block) {
  const pos = block.location;
  const key = tvKey(pos);
  let vf = VF_STATE.get(key);
  if (!vf) {
    vf = { pitch: 0, yaw: 0, locked: false };
    VF_STATE.set(key, vf);
  }
  const playerKey = `${player.id},${key}`;
  VF_LOCKED.set(playerKey, false);

  const form = new ModalFormData()
    .title("§7Viewfinder")
    .slider("§7Pitch (up/down)", -90, 90, 1, vf.pitch)
    .slider("§7Yaw (left/right)", -180, 180, 1, vf.yaw)
    .toggle("§7Lock View", false)
    .text_field("§7Bound Cassette Channel (leave empty to clear)", "", 32);

  form.show(player).then(res => {
    if (res.canceled) return;
    const [pitch, yaw, locked, channelInput] = res.formValues;
    vf.pitch = pitch;
    vf.yaw = yaw;
    vf.locked = locked;
    if (channelInput && channelInput.trim() !== "" && CHANNEL_MAP[channelInput.trim()]) {
      BOUND_CASSETTES.set(key, { cassette_id: channelInput.trim() });
      player.sendMessage(`§7Viewfinder bound to ${getChannelColor(channelInput.trim())}${channelInput.trim()} §7channel.`);
    }
    VF_ANGLES.set(playerKey, { pitch, yaw });
    VF_LOCKED.set(playerKey, locked);
    PLAYER_VF.set(player.id, key);
    if (locked) {
      player.sendMessage("§7Viewfinder view locked!");
    }
  });
}

function updateViewfinder(player) {
  const key = PLAYER_VF.get(player.id);
  if (!key) return;
  const vf = VF_STATE.get(key);
  if (!vf || !vf.locked) return;
  const playerKey = `${player.id},${key}`;
  const angles = VF_ANGLES.get(playerKey);
  if (!angles) return;
  const ent = CAMERA_ENTS.get(key);
  if (!ent || !ent.isValid) return;
  try {
    ent.teleport({ x: ent.x, y: ent.y, z: ent.z });
    const rot = player.getRotation();
    const look = player.getHeadRotation();
    ent.setRotation({ x: -angles.pitch, y: angles.yaw });
  } catch(e) {}
}

// ── Mirror Logic ─────────────────────────────────────────────────────────────
function handleMirrorPlaced(player, block) {
  const dim = block.dimension;
  const dir = block.getProperty("minecraft:cardinal_direction");
  const facing = getFacingVector(dir);
  try {
    block.dimension.spawnEntity("minecraft:armor_stand", {
      x: block.x + facing.x * 0.01,
      y: block.y + 0.5,
      z: block.z + facing.z * 0.01
    }, { Invisible: true, Marker: true, NoGravity: true });
  } catch(e) {}
}

// ── Picture Tape Logic ────────────────────────────────────────────────────────
function handlePictureTapeInsert(player, block) {
  const pos = block.location;
  const key = tvKey(pos);
  const pt = PT_STATE.get(key) || { pictures: [] };
  const inv = player.getComponent("inventory");
  const mapSlot = findMap(inv);
  if (mapSlot >= 0) {
    const item = inv.getItem(mapSlot);
    if (item && item.typeId.startsWith("minecraft:filled_map")) {
      pt.pictures.push(item.typeId);
      inv.setItem(mapSlot, { typeId: "minecraft:air", amount: 0 });
      PT_STATE.set(key, pt);
      player.sendMessage(`§6Picture added! (${pt.pictures.length} pictures)`);
      player.runCommandAsync("playsound note.pling @s ~~~ 1 1.5");
    }
  }
}

function findMap(inv) {
  for (let i = 0; i < 36; i++) {
    const item = inv.getItem(i);
    if (item && item.typeId.startsWith("minecraft:filled_map")) return i;
  }
  return -1;
}

// ── Wave Gate Logic ──────────────────────────────────────────────────────────
function openWaveGateForm(player, block) {
  const pos = block.location;
  const key = tvKey(pos);
  const existingUrl = WAVE_URLS.get(key) || "";
  const form = new ModalFormData()
    .title("§4Wave Gate")
    .text_field("§7URL or local file to stream:", existingUrl, 256);
  form.show(player).then(res => {
    if (res.canceled) return;
    const url = (res.formValues[0] || "").trim();
    if (url && url.startsWith("http")) {
      WAVE_URLS.set(key, url);
      player.sendMessage(`§aWave Gate URL set: §f${url.substring(0, 50)}`);
      player.runCommandAsync("playsound note.pling @s ~~~");
      spawnWaveGateDisplay(player, block, url);
    } else if (url) {
      WAVE_URLS.set(key, url);
      player.sendMessage(`§aLocal file set: §f${url}`);
    } else {
      WAVE_URLS.delete(key);
      player.sendMessage("§7Wave Gate URL cleared.");
    }
  });
}

function spawnWaveGateDisplay(player, block, url) {
  try {
    block.dimension.spawnEntity("minecraft:armor_stand", {
      x: block.x + 0.5, y: block.y + 1.5, z: block.z + 0.5
    }, {
      Invisible: true, Marker: true, NoGravity: true,
      CustomName: `WaveGate:${url.substring(0, 30)}`
    });
    player.sendMessage("§aMedia display spawned above Wave Gate.");
  } catch(e) {}
}

// ── Block Break Cleanup ──────────────────────────────────────────────────────
function onTVBreak(block) {
  const key = tvKey(block.location);
  TV_STATE.delete(key);
  const cam = CAMERA_ENTS.get(key);
  if (cam && cam.isValid) {
    try { cam.kill(); } catch(e) {}
  }
  CAMERA_ENTS.delete(key);
}

function onVfBreak(block) {
  const key = tvKey(block.location);
  VF_STATE.delete(key);
  BOUND_CASSETTES.delete(key);
  PLAYER_VF.forEach((v, id) => {
    if (v === key) PLAYER_VF.delete(id);
  });
  for (const [k] of VF_LOCKED.entries()) {
    if (k.endsWith(key)) VF_LOCKED.delete(k);
  }
}

// ── Tick Loop ────────────────────────────────────────────────────────────────
let tickCounter = 0;
function mainTick() {
  tickCounter++;
  if (tickCounter % 4 === 0) {
    world.getPlayers().forEach(player => {
      updateViewfinder(player);
    });
  }
  if (tickCounter % 80 === 0) {
    refreshWaveGates();
    refreshTVDisplays();
    refreshBoundHollowTapes();
  }
  system.run(mainTick);
}

function refreshTVDisplays() {
  TV_STATE.forEach((state, key) => {
    const [x, y, z] = key.split(",").map(Number);
    try {
      const b = world.getDimension("overworld").getBlock({ x, y, z });
      if (b && b.isValid && b.id === "vista:tv") {
        if (state.playing && isGettingPower(b)) {
          blockState(b, "minecraft:display_layer", state.channel === "none" ? "off" : "on");
        }
      }
    } catch(e) {}
  });
}

function refreshWaveGates() {
  WAVE_URLS.forEach((url, key) => {
    const [x, y, z] = key.split(",").map(Number);
    try {
      const b = world.getDimension("overworld").getBlock({ x, y, z });
      if (b && b.isValid && b.id === "vista:wave_gate" && isGettingPower(b)) {
        const ents = world.getDimension("overworld").getEntitiesFromName("WaveGateDisplay");
        ents.forEach(e => {
          if (e.nameTag && e.nameTag.includes(url.substring(0, 20))) {
            e.teleport({ x: x + 0.5, y: y + 1.5, z: z + 0.5 });
          }
        });
      }
    } catch(e) {}
  });
}

function refreshBoundHollowTapes() {
  BOUND_CASSETTES.forEach((data, key) => {
    const [x, y, z] = key.split(",").map(Number);
    try {
      const b = world.getDimension("overworld").getBlock({ x, y, z });
      if (b && b.isValid && b.id === "vista:tv") {
        const tvState = TV_STATE.get(key);
        if (tvState && tvState.channel === "hollow") {
          const vfPos = data.cassette_id;
          const [vx, vy, vz] = vfPos.split(",").map(Number);
          const vf = world.getDimension("overworld").getBlock({ x: vx, y: vy, z: vz });
          if (vf && vf.isValid && vf.id === "vista:viewfinder") {
            spawnCameraEntity(b);
          }
        }
      }
    } catch(e) {}
  });
}

// ── Get facing vector from cardinal direction ────────────────────────────────
function getFacingVector(dir) {
  switch(dir) {
    case "north": return { x: 0, z: -1 };
    case "south": return { x: 0, z: 1 };
    case "east":  return { x: 1, z: 0 };
    case "west":  return { x: -1, z: 0 };
    default:      return { x: 0, z: 1 };
  }
}

// ── Event Listeners ──────────────────────────────────────────────────────────
world.afterEvents.playerInteractWithBlock.subscribe(e => {
  const { block, player, itemStack } = e;
  if (!block || !player) return;
  const bId = block.id;
  if (bId === "vista:tv") {
    handleTVInteraction(player, block);
  } else if (bId === "vista:viewfinder") {
    handleViewfinderInteraction(player, block);
  } else if (bId === "vista:wave_gate") {
    openWaveGateForm(player, block);
  }
});

world.afterEvents.playerInteractWithBlock.subscribe(e => {
  const { block, itemStack } = e;
  if (!block) return;
  if (block.id === "vista:tv" && itemStack?.typeId === "vista:picture_tape") {
    handlePictureTapeInsert(e.player, block);
  }
});

world.afterEvents.redstoneUpdate.subscribe(e => {
  const { block } = e;
  if (!block) return;
  if (block.id === "vista:tv") {
    onRedstoneChange(e.player, block);
  }
});

world.afterEvents.playerBreakBlock.subscribe(e => {
  const { block, player } = e;
  if (!block) return;
  if (block.id === "vista:tv") onTVBreak(block);
  else if (block.id === "vista:viewfinder") onVfBreak(block);
});

world.afterEvents.playerPlaceBlock.subscribe(e => {
  const { block, player } = e;
  if (!block) return;
  if (block.id === "vista:mirror") {
    handleMirrorPlaced(player, block);
  }
});

world.afterEvents.playerLeave.subscribe(e => {
  const pid = e.player.id;
  PLAYER_VF.delete(pid);
  for (const [k, v] of VF_LOCKED.entries()) {
    if (k.startsWith(pid)) VF_LOCKED.delete(k);
  }
  for (const [k, v] of VF_ANGLES.entries()) {
    if (k.startsWith(pid)) VF_ANGLES.delete(k);
  }
});

world.afterEvents.entityHurt.subscribe(e => {
  const { hurtEntity, damagingEntity } = e;
  if (!hurtEntity || !damagingEntity) return;
  const ht = hurtEntity.typeId;
  if (ht === "minecraft:enderman") {
    const dim = hurtEntity.dimension;
    const dimId = dim.id;
    const tvNearby = world.getPlayers().some(p => {
      const la = p.location;
      return dim.getBlock({ x: Math.floor(la.x), y: Math.floor(la.y), z: Math.floor(la.z) })?.id === "vista:tv";
    });
    if (tvNearby) {
      try {
        damagingEntity.runCommandAsync("tag @s add vista_sojourn_drop");
      } catch(e) {}
    }
  }
});

world.afterEvents.entityDie.subscribe(e => {
  const { deadEntity } = e;
  if (!deadEntity) return;
  const hasTag = (deadEntity.getTags() || []).includes("vista_sojourn_drop");
  if (deadEntity.typeId === "minecraft:enderman" && hasTag) {
    try {
      deadEntity.runCommandAsync(
        "summon item ~~~ {Item:{id:minecraft:music_disc_5,Count:1b}}");
    } catch(e) {}
  }
});

// ── Advancement hook ─────────────────────────────────────────────────────────
world.afterEvents.playerPlaceBlock.subscribe(e => {
  const { block, player } = e;
  if (!block || block.id !== "vista:tv") return;
  const key = tvKey(block.location);
  const neighbors = [
    { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }
  ];
  let totalSize = 1;
  const visited = new Set([key]);
  const queue = [{ x: block.x, z: block.z }];
  while (queue.length > 0 && totalSize < 64) {
    const { x, z } = queue.shift();
    for (const n of neighbors) {
      const nx = x + n.x, nz = z + n.z;
      const nk = `${nx},${block.y},${nz}`;
      if (visited.has(nk)) continue;
      visited.add(nk);
      try {
        const nb = block.dimension.getBlock({ x: nx, y: block.y, z: nz });
        if (nb && nb.isValid && nb.id === "vista:tv") {
          totalSize++;
          queue.push({ x: nx, z: nz });
        }
      } catch(e) {}
    }
  }
  if (totalSize >= 8) {
    try {
      player.runCommandAsync("advancement grant @s only vista:absolute_cinema");
    } catch(e) {}
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────
world.sendMessage("§3§lVista §7loaded! §eWorking Screens §7for Minecraft Bedrock Edition.");
system.run(mainTick);
