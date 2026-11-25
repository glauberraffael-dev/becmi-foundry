const fields = () => foundry.data.fields;

class SourceData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = fields();
    return {
      description: new f.HTMLField({ initial: "" }),
      source: new f.StringField({ initial: "Rules Cyclopedia" }),
      page: new f.NumberField({ initial: 0, integer: true, min: 0 }),
      notes: new f.StringField({ initial: "" }),
      rollFormula: new f.StringField({ initial: "", label: "BECMI.labels.rollFormula" })
    };
  }
}

export class WeaponData extends SourceData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      damage: new f.StringField({ initial: "1d6", label: "BECMI.labels.damage" }),
      damageBonus: new f.NumberField({ initial: 0, integer: true }),
      attackBonus: new f.NumberField({ initial: 0, integer: true }),
      magicBonus: new f.NumberField({ initial: 0, integer: true }),
      range: new f.NumberField({ initial: 0, integer: true, min: 0 }),
      rate: new f.NumberField({ initial: 1, integer: true, min: 1 }),
      hands: new f.NumberField({ initial: 1, integer: true, min: 1, max: 2 }),
      weaponType: new f.StringField({ initial: "melee" }),
      attackAbility: new f.StringField({ initial: "str" }),
      cost: new f.StringField({ initial: "" }),
      weight: new f.NumberField({ initial: 0, min: 0 })
    };
  }
}

export class ArmorData extends SourceData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      ac: new f.NumberField({ initial: 0, integer: true, label: "BECMI.labels.ac" }),
      acBonus: new f.NumberField({ initial: 0, integer: true }),
      armorType: new f.StringField({ initial: "" }),
      cost: new f.StringField({ initial: "" }),
      weight: new f.NumberField({ initial: 0, min: 0 })
    };
  }
}

export class EquipmentData extends SourceData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      quantity: new f.NumberField({ initial: 1, integer: true, min: 0 }),
      cost: new f.StringField({ initial: "" }),
      weight: new f.NumberField({ initial: 0, min: 0 })
    };
  }
}

export class SpellData extends SourceData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      spellLevel: new f.NumberField({ initial: 1, integer: true, min: 1, max: 9, label: "BECMI.labels.spellLevel" }),
      spellLists: new f.ArrayField(new f.StringField(), { initial: [] }),
      range: new f.StringField({ initial: "", label: "BECMI.labels.range" }),
      duration: new f.StringField({ initial: "", label: "BECMI.labels.duration" }),
      effect: new f.StringField({ initial: "", label: "BECMI.labels.effect" }),
      reversible: new f.BooleanField({ initial: false, label: "BECMI.labels.reversible" })
    };
  }
}

export class ClassData extends SourceData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      primeRequisite: new f.StringField({ initial: "" }),
      hitDice: new f.StringField({ initial: "1d8" }),
      maxLevel: new f.NumberField({ initial: 36, integer: true, min: 1, max: 36 }),
      requirements: new f.StringField({ initial: "" }),
      xpTable: new f.ObjectField({ initial: {} }),
      saves: new f.ObjectField({ initial: {} })
    };
  }
}

export class FeatureData extends SourceData {
  static defineSchema() {
    return super.defineSchema();
  }
}

export class TreasureData extends SourceData {
  static defineSchema() {
    const f = fields();
    return {
      ...super.defineSchema(),
      treasureType: new f.StringField({ initial: "", label: "BECMI.labels.treasure" }),
      value: new f.NumberField({ initial: 0, integer: true, min: 0 })
    };
  }
}
