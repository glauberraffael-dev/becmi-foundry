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
  const skill = () => new f.NumberField({ initial: 0, integer: true, min: 0, max: 100, label: "BECMI.labels.value" });
  return new f.SchemaField({
    pickPockets: skill(),
    openLocks: skill(),
    removeTraps: skill(),
    climbWalls: skill(),
    moveSilently: skill(),
    hideInShadows: skill(),
    hearNoise: skill(),
    backstab: skill()
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
    classUuid: new f.StringField({ initial: "" }),
    race: new f.StringField({ initial: "Human", label: "BECMI.labels.race" }),
    alignment: new f.StringField({ initial: "Neutral", label: "BECMI.labels.alignment" }),
    primeRequisite: new f.StringField({ initial: "" }),
    hd: new f.StringField({ initial: "1d8" }),
    thac0: new f.NumberField({ initial: 19, integer: true, min: 1, max: 20, label: "BECMI.labels.thac0" }),
    attackBonus: new f.NumberField({ initial: 0, integer: true }),
    damageBonus: new f.NumberField({ initial: 0, integer: true }),
    initiativeBonus: new f.NumberField({ initial: 0, integer: true }),
    ac: new f.SchemaField({
      base: new f.NumberField({ initial: 0, integer: true, label: "BECMI.labels.ac" }),
      value: new f.NumberField({ initial: 0, integer: true })
    }),
    acBonus: new f.NumberField({ initial: 0, integer: true }),
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
      thiefSkills: thiefSkillSchema(),
      specialAbilities: new f.HTMLField({ initial: "" }),
      languages: new f.StringField({ initial: "", label: "BECMI.labels.languages" }),
      biography: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const attrs = this.attributes;
    attrs.ac.value = attrs.ac.base + attrs.acBonus;
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
