import { RC, adjustment, attackSpecFor, baseSaves, baseThiefSkills, computeArmorClass, computeLoad, normalizeClassKey } from "../rules-rc.mjs";

const fields = () => foundry.data.fields;

function abilitySchema() {
  const f = fields();
  const entry = () => new f.SchemaField({
    value: new f.NumberField({ initial: 10, integer: true, min: 1, label: "BECMI.labels.value" }),
    bonus: new f.NumberField({ initial: 0, integer: true, label: "BECMI.labels.saveBonus" })
  });
  return new f.SchemaField({
    str: entry(), int: entry(), wis: entry(), dex: entry(), con: entry(), cha: entry()
  });
}

function savingThrowSchema() {
  const f = fields();
  const save = () => new f.NumberField({ initial: 10, integer: true, min: 2, max: 20, label: "BECMI.labels.value" });
  return new f.SchemaField({
    deathRay: save(), magicWand: save(), paralysis: save(), breath: save(), spells: save()
  });
}

function thiefSkillSchema() {
  const f = fields();
  const skill = () => new f.NumberField({ initial: 0, integer: true, min: 0, max: 200, label: "BECMI.labels.value" });
  return new f.SchemaField({
    pickPockets: skill(),
    openLocks: skill(),
    findTraps: skill(),
    removeTraps: skill(),
    climbWalls: skill(),
    moveSilently: skill(),
    hideInShadows: skill(),
    hearNoise: skill(),
    backstab: skill()
  });
}

function characterSaveSchema() {
  const f = fields();
  const entry = () => new f.SchemaField({
    base: new f.NumberField({ initial: 10, integer: true, label: "BECMI.labels.saveBase" }),
    auto: new f.NumberField({ initial: 0, integer: true, label: "BECMI.labels.saveAuto" }),
    mod: new f.NumberField({ initial: 0, integer: true, label: "BECMI.labels.saveMod" }),
    target: new f.NumberField({ initial: 10, integer: true, label: "BECMI.labels.saveTarget" })
  });
  return new f.SchemaField({
    deathRay: entry(), magicWand: entry(), paralysis: entry(), breath: entry(), spells: entry()
  });
}

function spellbookSchema() {
  const f = fields();
  return new f.SchemaField({
    grimoire: new f.StringField({ initial: "", label: "BECMI.labels.grimoire" }),
    memorized: new f.ObjectField({ initial: {} }),
    used: new f.ObjectField({ initial: {} })
  });
}

function magicItemsSchema() {
  const f = fields();
  const emptyRow = () => ({
    equipped: false,
    name: "",
    ac: 0,
    save: 0,
    attack: 0,
    damage: 0,
    notes: ""
  });
  const row = () => new f.SchemaField({
    equipped: new f.BooleanField({ initial: false }),
    name: new f.StringField({ initial: "" }),
    ac: new f.NumberField({ initial: 0, integer: true }),
    save: new f.NumberField({ initial: 0, integer: true }),
    attack: new f.NumberField({ initial: 0, integer: true }),
    damage: new f.NumberField({ initial: 0, integer: true }),
    notes: new f.StringField({ initial: "" })
  });
  return new f.ArrayField(row(), { initial: Array.from({ length: 10 }, emptyRow) });
}

function masterySchema() {
  const f = fields();
  return new f.SchemaField({
    enabled: new f.BooleanField({ initial: false, label: "BECMI.labels.useMastery" }),
    rows: new f.ArrayField(new f.SchemaField({
      name: new f.StringField({ initial: "" }),
      grade: new f.StringField({ initial: "sem" }),
      primary: new f.StringField({ initial: "prim" }),
      target: new f.StringField({ initial: "prim" })
    }), { initial: [] })
  });
}

function identitySchema() {
  const f = fields();
  return new f.SchemaField({
    level: new f.NumberField({ initial: 1, integer: true, min: 1, max: 36, label: "BECMI.labels.level" }),
    xp: new f.NumberField({ initial: 0, integer: true, min: 0, label: "BECMI.labels.xp" }),
    xpNext: new f.NumberField({ initial: 0, integer: true, min: 0, label: "BECMI.labels.xpNext" }),
    player: new f.StringField({ initial: "", label: "BECMI.labels.player" }),
    class: new f.StringField({ initial: "", label: "BECMI.labels.class" }),
    classKey: new f.StringField({ initial: "" }),
    classUuid: new f.StringField({ initial: "" }),
    race: new f.StringField({ initial: "Human", label: "BECMI.labels.race" }),
    alignment: new f.StringField({ initial: "Neutral", label: "BECMI.labels.alignment" }),
    primeRequisite: new f.StringField({ initial: "" }),
    hd: new f.StringField({ initial: "1d8" }),
    thac0: new f.NumberField({ initial: 19, integer: true, min: 1, max: 40, label: "BECMI.labels.thac0" }),
    attackSpec: new f.StringField({ initial: "19" }),
    attackBand: new f.StringField({ initial: "" }),
    attackBonus: new f.NumberField({ initial: 0, integer: true }),
    damageBonus: new f.NumberField({ initial: 0, integer: true }),
    initiativeBonus: new f.NumberField({ initial: 0, integer: true }),
    ac: new f.SchemaField({
      base: new f.NumberField({ initial: 9, integer: true, label: "BECMI.labels.ac" }),
      value: new f.NumberField({ initial: 9, integer: true })
    }),
    acBonus: new f.NumberField({ initial: 0, integer: true }),
    armor: new f.SchemaField({
      type: new f.StringField({ initial: "nenhuma", label: "BECMI.labels.armorType" }),
      magicBonus: new f.NumberField({ initial: 0, integer: true }),
      shield: new f.BooleanField({ initial: false, label: "BECMI.labels.shield" }),
      shieldMagic: new f.NumberField({ initial: 0, integer: true })
    }),
    load: new f.SchemaField({
      armor: new f.NumberField({ initial: 0, integer: true }),
      shield: new f.NumberField({ initial: 0, integer: true }),
      coins: new f.NumberField({ initial: 0, integer: true }),
      equipment: new f.NumberField({ initial: 0, integer: true }),
      gems: new f.NumberField({ initial: 0, integer: true }),
      jewels: new f.NumberField({ initial: 0, integer: true }),
      weapons: new f.NumberField({ initial: 0, integer: true }),
      total: new f.NumberField({ initial: 0, integer: true }),
      movementTurn: new f.NumberField({ initial: 120, integer: true }),
      movementRound: new f.NumberField({ initial: 40, integer: true })
    }),
    adjustments: new f.SchemaField({
      str: new f.NumberField({ initial: 0, integer: true }),
      int: new f.NumberField({ initial: 0, integer: true }),
      wis: new f.NumberField({ initial: 0, integer: true }),
      dex: new f.NumberField({ initial: 0, integer: true }),
      con: new f.NumberField({ initial: 0, integer: true }),
      cha: new f.NumberField({ initial: 0, integer: true })
    }),
    hp: new f.SchemaField({
      value: new f.NumberField({ initial: 4, integer: true, min: 0 }),
      max: new f.NumberField({ initial: 4, integer: true, min: 0 })
    }),
    movement: new f.SchemaField({
      base: new f.NumberField({ initial: 120, integer: true }),
      dungeon: new f.NumberField({ initial: 120, integer: true }),
      outdoor: new f.NumberField({ initial: 360, integer: true })
    }),
    gold: new f.SchemaField({
      pp: new f.NumberField({ initial: 0, integer: true, min: 0 }),
      gp: new f.NumberField({ initial: 0, integer: true, min: 0 }),
      ep: new f.NumberField({ initial: 0, integer: true, min: 0 }),
      sp: new f.NumberField({ initial: 0, integer: true, min: 0 }),
      cp: new f.NumberField({ initial: 0, integer: true, min: 0 })
    }),
    details: new f.SchemaField({
      age: new f.NumberField({ initial: 0, integer: true }),
      height: new f.StringField({ initial: "" }),
      weight: new f.StringField({ initial: "" }),
      personality: new f.StringField({ initial: "" }),
      background: new f.StringField({ initial: "" })
    })
  });
}

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = fields();
    return {
      abilities: abilitySchema(),
      attributes: identitySchema(),
      saves: savingThrowSchema(),
      saveDetail: characterSaveSchema(),
      thiefSkills: thiefSkillSchema(),
      spellbook: spellbookSchema(),
      mastery: masterySchema(),
      magicItems: magicItemsSchema(),
      specialAbilities: new f.HTMLField({ initial: "" }),
      languages: new f.StringField({ initial: "", label: "BECMI.labels.languages" }),
      biography: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const attrs = this.attributes;
    const abilityKeys = Object.keys(attrs.adjustments ?? {});
    for (const key of abilityKeys) {
      const value = this.abilities?.[key]?.value;
      const derived = adjustment(value);
      if (derived !== null) attrs.adjustments[key] = derived;
    }

    const className = attrs.classKey || attrs.class;
    const key = normalizeClassKey(className);
    const level = Number(attrs.level) || 1;
    const xp = Number(attrs.xp) || 0;

    const armor = attrs.armor ?? {};
    const ac = computeArmorClass({
      type: armor.type,
      shield: armor.shield,
      dexAdj: attrs.adjustments?.dex ?? 0,
      magicArmor: armor.magicBonus,
      magicShield: armor.shieldMagic,
      itemBonus: attrs.acBonus
    });
    attrs.ac.base = ac.base;
    attrs.ac.value = ac.value;

    const coins = Number(attrs.gold?.pp ?? 0) + Number(attrs.gold?.gp ?? 0) + Number(attrs.gold?.ep ?? 0)
      + Number(attrs.gold?.sp ?? 0) + Number(attrs.gold?.cp ?? 0);
    const load = computeLoad({
      armor: armor.type,
      shield: armor.shield,
      coins,
      equipment: attrs.load?.equipment,
      gems: attrs.load?.gems,
      jewels: attrs.load?.jewels,
      weapons: attrs.load?.weapons
    });
    attrs.load.armor = Number(RC.armor.weights[armor.type] ?? 0);
    attrs.load.shield = armor.shield ? Number(RC.armor.shieldWeight) : 0;
    attrs.load.coins = coins;
    attrs.load.total = load.total;
    attrs.load.movementTurn = load.movementTurn;
    attrs.load.movementRound = load.movementRound;
    attrs.movement.base = load.movementTurn;
    attrs.movement.dungeon = load.movementRound;
    attrs.movement.outdoor = load.movementTurn * 3;

    if (key) {
      const attack = attackSpecFor(key, level, xp);
      attrs.attackSpec = String(attack.spec);
      attrs.attackBand = attack.label;
      attrs.thac0 = parseInt(attack.thac0, 10) || attrs.thac0;

      const bases = baseSaves(key, level);
      for (const [saveKey, base] of Object.entries(bases)) {
        const detail = this.saveDetail?.[saveKey];
        if (!detail) continue;
        const auto = Number(detail.auto || 0) + (saveKey === "spells" ? (attrs.adjustments?.wis ?? 0) : 0);
        detail.base = base;
        detail.target = base - auto - Number(detail.mod || 0);
        this.saves[saveKey] = detail.target;
      }

      const skills = baseThiefSkills(level);
      for (const [skillKey, value] of Object.entries(skills)) {
        if (this.thiefSkills?.[skillKey] !== undefined) this.thiefSkills[skillKey] = value;
      }
    }
  }
}

export class NPCData extends CharacterData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      retainer: new f.SchemaField({
        loyalty: new f.NumberField({ initial: 8, integer: true, min: 1, max: 12 }),
        morale: new f.NumberField({ initial: 7, integer: true, min: 2, max: 12 }),
        wage: new f.StringField({ initial: "" })
      })
    };
  }
}

export class MonsterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = fields();
    return {
      ac: new f.NumberField({ initial: 9, integer: true, label: "BECMI.labels.ac" }),
      hd: new f.StringField({ initial: "1", label: "BECMI.labels.hd" }),
      hp: new f.NumberField({ initial: 1, integer: true, min: 0, label: "BECMI.labels.hp" }),
      move: new f.SchemaField({
        dungeon: new f.NumberField({ initial: 120, integer: true }),
        outdoor: new f.NumberField({ initial: 360, integer: true })
      }),
      attacks: new f.StringField({ initial: "", label: "BECMI.labels.attacks" }),
      damage: new f.StringField({ initial: "", label: "BECMI.labels.damage" }),
      appearing: new f.StringField({ initial: "", label: "BECMI.labels.appearing" }),
      saveAs: new f.StringField({ initial: "", label: "BECMI.labels.saveAs" }),
      morale: new f.NumberField({ initial: 7, integer: true, min: 2, max: 12, label: "BECMI.labels.morale" }),
      treasure: new f.StringField({ initial: "", label: "BECMI.labels.treasure" }),
      intelligence: new f.NumberField({ initial: 5, integer: true, min: 0, max: 20, label: "BECMI.labels.intelligence" }),
      alignment: new f.StringField({ initial: "Neutral", label: "BECMI.labels.alignment" }),
      xpValue: new f.NumberField({ initial: 0, integer: true, min: 0, label: "BECMI.labels.xpValue" }),
      // Mirrors hp so the token HP bar works for every Actor type.
      attributes: new f.SchemaField({
        hp: new f.SchemaField({
          value: new f.NumberField({ initial: 1, integer: true, min: 0 }),
          max: new f.NumberField({ initial: 1, integer: true, min: 0 })
        })
      }),
      terrain: new f.StringField({ initial: "", label: "BECMI.labels.terrain" }),
      monsterType: new f.StringField({ initial: "" }),
      saves: savingThrowSchema(),
      special: new f.HTMLField({ initial: "" }),
      description: new f.HTMLField({ initial: "" }),
      notes: new f.HTMLField({ initial: "" }),
      source: new f.StringField({ initial: "Rules Cyclopedia" }),
      page: new f.NumberField({ initial: 0, integer: true })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.attributes.hp.max = Number(this.hp) || 0;
    if (!Number.isFinite(this.attributes.hp.value)) this.attributes.hp.value = this.attributes.hp.max;
  }
}
