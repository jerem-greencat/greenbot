import { assignRole } from "../../application/roles/roleManager.js";
import { Collection } from "discord.js";
import * as createRoleButton from "../commands/createRoleButton.js";

const commands = new Collection();
commands.set(createRoleButton.data.name, createRoleButton);

export async function handleInteraction(interaction) {
    if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }
    
    if (interaction.isButton()) {
        const [type, role] = interaction.customId.split(":");
        if (type === "role") {
            await assignRole(interaction, role);
        }
    }
}
