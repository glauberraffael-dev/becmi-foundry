import { CharacterData, NPCData, MonsterData } from "./data/actor.mjs";
import {
  WeaponData, ArmorData, EquipmentData, SpellData, ClassData, FeatureData, TreasureData
} from "./data/item.mjs";
import { BECMIActor } from "./documents/actor.mjs";
import { BECMIItem } from "./documents/item.mjs";
import { BECMIActorSheet } from "./sheets/actor-sheet.mjs";
import { BECMIItemSheet } from "./sheets/item-sheet.mjs";

const ACTOR_TYPES = ["character", "npc", "monster"];
const ITEM_TYPES = ["weapon", "armor", "equipment", "spell", "class", "feature", "treasure"];

Hooks.once("init", () => {
  CONFIG.Actor.documentClass = BECMIActor;
  CONFIG.Item.documentClass = BECMIItem;

  CONFIG.Actor.dataModels = Object.assign(CONFIG.Actor.dataModels ?? {}, {
    character: CharacterData,
    npc: NPCData,
    monster: MonsterData
  });
  CONFIG.Item.dataModels = Object.assign(CONFIG.Item.dataModels ?? {}, {
    weapon: WeaponData,
    armor: ArmorData,
    equipment: EquipmentData,
    spell: SpellData,
    class: ClassData,
    feature: FeatureData,
    treasure: TreasureData
  });

  CONFIG.Actor.typeLabels = Object.assign(CONFIG.Actor.typeLabels ?? {}, {
    character: "BECMI.actor.character",
    npc: "BECMI.actor.npc",
    monster: "BECMI.actor.monster"
  });
  CONFIG.Item.typeLabels = Object.assign(CONFIG.Item.typeLabels ?? {}, {
    weapon: "BECMI.item.weapon",
    armor: "BECMI.item.armor",
    equipment: "BECMI.item.equipment",
    spell: "BECMI.item.spell",
    class: "BECMI.item.class",
    feature: "BECMI.item.feature",
    treasure: "BECMI.item.treasure"
  });

  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["attributes.hp"], value: ["attributes.level", "attributes.xp"] },
    npc: { bar: ["attributes.hp"], value: ["attributes.level"] },
    monster: { bar: ["attributes.hp.value"], value: ["ac", "morale"] }
  };

  foundry.documents.collections.Actors.registerSheet("becmi", BECMIActorSheet, {
    types: ACTOR_TYPES,
    makeDefault: true,
    label: "BECMI.title"
  });
  foundry.documents.collections.Items.registerSheet("becmi", BECMIItemSheet, {
    types: ITEM_TYPES,
    makeDefault: true,
    label: "BECMI.title"
  });

  foundry.applications.handlebars.loadTemplates([
    "systems/becmi/templates/chat/roll.hbs",
    "systems/becmi/templates/chat/item.hbs"
  ]).catch(() => {});
});

Hooks.once("setup", () => {
  game.settings.register("becmi", "showDice", {
    name: "Show individual dice in roll cards",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

console.log("BECMI | System loaded");
