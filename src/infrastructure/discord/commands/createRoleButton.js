import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ComponentType
} from "discord.js";
import { roleNameMap } from "../../../domain/roles/roleMapping.js";

export const data = new SlashCommandBuilder()
.setName("create-role-button")
.setDescription("Crée un menu pour choisir plusieurs rôles");

export async function execute(interaction) {
    const menu = new StringSelectMenuBuilder()
    .setCustomId("select-roles")
    .setPlaceholder("Choisis un ou plusieurs rôles")
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("🐺🔵 Wolf 🔵🐺").setValue("wolf"),
        new StringSelectMenuOptionBuilder().setLabel("⚪️ Neutre ⚪️").setValue("neutre"),
        new StringSelectMenuOptionBuilder().setLabel("🐻🔴 Bear 🔴🐻").setValue("bear")
    );
    
    const row = new ActionRowBuilder().addComponents(menu);
    
    await interaction.reply({
        content: "Choisis les rôles à ajouter sous forme de boutons :",
        components: [row],
        ephemeral: true
    });
    
    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60_000,
        max: 1
    });
    
    collector.on("collect", async selectInteraction => {
        const selectedRoles = selectInteraction.values;
        
        const buttons = selectedRoles.map(roleKey =>
            new ButtonBuilder()
            .setCustomId(`role:${roleKey}`)
            .setLabel(`${roleNameMap[roleKey]}`)
            .setStyle(ButtonStyle.Primary)
        );
        
        const row = new ActionRowBuilder().addComponents(buttons);
        
        await selectInteraction.reply({
            content: "",
            components: [row]
        });
    });
    
    collector.on("end", collected => {
        if (collected.size === 0) {
            interaction.followUp({ content: "⏱️ Temps écoulé, aucun rôle sélectionné.", ephemeral: true });
        }
    });
}
