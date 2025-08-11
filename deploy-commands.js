// deploy-commands.js
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const need = (k) => {
    const v = process.env[k];
    if (!v) throw new Error(`Variable d'env manquante: ${k}`);
    return v;
};

const DISCORD_TOKEN = need('DISCORD_TOKEN');
const CLIENT_ID     = need('CLIENT_ID');
const GUILD_IDS     = need('GUILD_IDS')
.split(',').map(s => s.trim()).filter(Boolean);

// Marqueur pour éviter tout effet de bord lors du chargement des modules de commandes
process.env.COMMANDS_DEPLOY = '1';

// ---- Configs contrôlables via env ----
const PER_GUILD_TIMEOUT_MS = Number(process.env.CMD_DEPLOY_TIMEOUT_MS ?? 20000); // 20s
const ENABLE_GLOBAL_FALLBACK = process.env.CMD_DEPLOY_FALLBACK_GLOBAL !== '0';

// ---- Charger les commandes ----
const commandsDir = path.join(__dirname, 'src/infrastructure/discord/commands');
const commands = [];

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    const url = pathToFileURL(path.join(commandsDir, file)).href;
    try {
        const mod = await import(url);
        const cmd = mod?.default;
        if (!cmd?.data?.toJSON) {
            console.warn(`⚠️  ${file} ignoré (pas d'export default.data).`);
            continue;
        }
        commands.push(cmd.data.toJSON());
    } catch (e) {
        console.error(`❌ Import raté pour ${file}:`, e);
        process.exitCode = 1;
    }
}

const rest = new REST({ version: '10', timeout: 15000 }).setToken(DISCORD_TOKEN);

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout après ${ms}ms${label ? ` (${label})` : ''}`)), ms)
    ),
]);
}

(async () => {
    console.log(`🛠️  (Re)Déploiement de ${commands.length} commandes…`);
    
    const failedGuilds = [];
    for (const gid of GUILD_IDS) {
        console.log(`→ Déploiement sur ${gid}…`);
        try {
            await withTimeout(
                rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands }),
                PER_GUILD_TIMEOUT_MS,
                `guild ${gid}`
            );
            console.log(`✓ OK ${gid}`);
        } catch (err) {
            console.error(`✗ Échec/Timeout ${gid}:`, err?.message ?? err);
            failedGuilds.push(gid);
            // on continue, pas de blocage global
        }
    }
    
    if (failedGuilds.length && ENABLE_GLOBAL_FALLBACK) {
        console.warn(`⚠️  Fallback: mise à jour des commandes **globales** (propagation lente).`);
        try {
            await withTimeout(
                rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }),
                PER_GUILD_TIMEOUT_MS,
                'global'
            );
            console.log('✓ Fallback global effectué.');
        } catch (e) {
            console.error('✗ Fallback global échoué:', e?.message ?? e);
            process.exitCode = 1;
        }
    }
    
    // Diagnostic (si quelque chose retient encore le process)
    const handles = (process._getActiveHandles?.() ?? []).map(h => h?.constructor?.name ?? 'unknown');
    if (handles.length) console.warn('⚠️  Handles encore ouverts:', handles);
})()
.catch(e => { console.error('❌ Erreur fatale:', e); process.exitCode = 1; })
.finally(() => {
    // Quoi qu'il arrive, on termine le process pour ne pas bloquer Render
    setTimeout(() => process.exit(process.exitCode ?? 0), 0);
});
