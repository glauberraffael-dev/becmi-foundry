import {
  abilityCheck, detectEvilRoll, freeRoll, generalSkillRoll, hitDiceRoll, initiativeRoll,
  monsterAttackRoll, monsterDamageRoll, monsterHpRoll, moraleCheck, savingThrow,
  thiefSkillRoll, turnUndeadRoll
} from "../rolls.mjs";
import { computeArmorClass, equippedAcBonus } from "../rules-rc.mjs";

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
        itemBonus: equippedAcBonus(this.items, this.system?.magicItems)
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

  /** Apply a rolled HD result to monster HP (and the mirrored token bar). */
  async rollMonsterHitPoints(options = {}) {
    return monsterHpRoll(this, options);
  }

  /** Roll one natural attack by index; each row has its own attack button. */
  async rollMonsterAttack(index, options = {}) {
    return monsterAttackRoll(this, index, options);
  }

  /** Roll damage for one natural attack without rolling the attack first. */
  async rollMonsterDamage(index, options = {}) {
    return monsterDamageRoll(this, index, options);
  }

  async rollFree(expression, options = {}) {
    return freeRoll(this, expression, options);
  }

  async rollThiefSkill(skill, options = {}) {
    return thiefSkillRoll(this, skill, options);
  }

  async rollGeneralSkill(skill, options = {}) {
    return generalSkillRoll(this, skill, options);
  }

  async rollTurnUndead(typeName, options = {}) {
    return turnUndeadRoll(this, typeName, options);
  }

  /** Name-level paladin/avenger Detect Evil (no roll, one use per round). */
  async rollDetectEvil(options = {}) {
    return detectEvilRoll(this, options);
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
