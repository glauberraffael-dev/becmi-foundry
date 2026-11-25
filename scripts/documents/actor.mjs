import { abilityCheck, freeRoll, hitDiceRoll, initiativeRoll, moraleCheck, savingThrow, thiefSkillRoll, turnUndeadRoll } from "../rolls.mjs";
import { computeArmorClass } from "../rules-rc.mjs";

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
    const attrs = this.system?.attributes;
    if (attrs?.ac && !Number.isFinite(attrs.ac.value)) {
      const armor = attrs.armor ?? {};
      attrs.ac.value = computeArmorClass({
        type: armor.type,
        shield: armor.shield,
        dexAdj: attrs.adjustments?.dex ?? 0,
        magicArmor: armor.magicBonus,
        magicShield: armor.shieldMagic,
        itemBonus: attrs.acBonus
      }).value;
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

  async rollFree(expression, options = {}) {
    return freeRoll(this, expression, options);
  }

  async rollThiefSkill(skill, options = {}) {
    return thiefSkillRoll(this, skill, options);
  }

  async rollTurnUndead(typeName, options = {}) {
    return turnUndeadRoll(this, typeName, options);
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
