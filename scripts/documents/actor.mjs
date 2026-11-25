import { abilityCheck, initiativeRoll, moraleCheck, savingThrow, hitDiceRoll } from "../rolls.mjs";

export class BECMIActor extends Actor {
  /** Flat roll data so formulas can reference @str, @thac0, @ac, @level, etc. */
  getRollData() {
    const data = super.getRollData();
    const attrs = this.system.attributes ?? {};
    return {
      ...data,
      ...attrs,
      abilities: this.system.abilities ?? {},
      saves: this.system.saves ?? {}
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const attrs = this.system.attributes;
    if (attrs && !Number.isFinite(attrs.ac.value)) {
      attrs.ac.value = (attrs.ac.base ?? 0) + (attrs.acBonus ?? 0);
    }
  }

  async rollAbility(ability, options = {}) {
    return abilityCheck(this, ability, options);
  }

  async rollSave(type, options = {}) {
    return savingThrow(this, type, options);
  }

  async rollInitiative(options = {}) {
    return initiativeRoll(this, options);
  }

  async rollMorale(options = {}) {
    return moraleCheck(this, options);
  }

  async rollHitDice(options = {}) {
    return hitDiceRoll(this, options);
  }

  /** Total XP needed for the next level, from the class compendium table. */
  async resolveNextLevel() {
    if (this.type !== "character") return null;
    const cls = await fromUuid(this.system.attributes.classUuid ?? "");
    const table = cls?.system?.xpTable;
    if (!table) return null;
    const level = Number(this.system.attributes.level) + 1;
    return table[level] ?? null;
  }
}
