import { attackRoll, damageRoll } from "../rolls.mjs";

export class BECMIItem extends Item {
  getRollData() {
    return { ...super.getRollData(), ...this.system };
  }

  get isWeapon() {
    return this.type === "weapon";
  }

  async rollAttack(options = {}) {
    if (!this.isWeapon) return null;
    return attackRoll(this.actor, this, options);
  }

  async rollDamage(options = {}) {
    return damageRoll(this.actor, this, options);
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
