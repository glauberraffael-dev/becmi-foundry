import { attackRoll, damageRoll, itemFormulaRoll } from "../rolls.mjs";

export class BECMIItem extends Item {
  getRollData() {
    return { ...super.getRollData(), ...this.system };
  }

  get isWeapon() {
    return this.type === "weapon";
  }

  get isSpell() {
    return this.type === "spell";
  }

  /** Attack rolls accept an explicit AC and never require a selected token. */
  async rollAttack(options = {}) {
    if (!this.isWeapon) return null;
    return attackRoll(this.actor, this, options);
  }

  async rollDamage(options = {}) {
    return damageRoll(this.actor, this, options);
  }

  /** Roll a spell effect, magical item damage or any other stored formula. */
  async rollFormula(options = {}) {
    return itemFormulaRoll(this.actor, this, options);
  }

  /** Cast a spell from an item sheet or actor sheet; rolls its formula if set. */
  async castSpell(options = {}) {
    if (!this.isSpell) return null;
    if (this.system.rollFormula) return this.rollFormula(options);
    return this.sendToChat();
  }

  async sendToChat() {
    const html = await foundry.applications.handlebars.renderTemplate(
      "systems/becmi/templates/chat/item.hbs",
      { item: this, system: this.system, description: this.system.description }
    );
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: html,
      flavor: this.name
    });
  }
}
