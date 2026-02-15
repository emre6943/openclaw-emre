import type { OpenClawConfig } from "../../config/config.js";
import type { ReplyPayload } from "../types.js";
import type { CommandHandler } from "./commands-types.js";
import { resolveAgentDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { updateSessionStore } from "../../config/sessions.js";
import { buildAuthProfileKeyboard, type AuthProfileInfo } from "../../telegram/auth-buttons.js";

/**
 * Build auth profile data from config and store.
 */
export function buildAuthProfileData(cfg: OpenClawConfig): {
  profiles: AuthProfileInfo[];
  profileIds: string[];
} {
  const configProfiles = cfg.auth?.profiles;
  if (!configProfiles || Object.keys(configProfiles).length === 0) {
    return { profiles: [], profileIds: [] };
  }

  const agentId = resolveDefaultAgentId(cfg);
  const agentDir = resolveAgentDir(cfg, agentId);
  const store = ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false });

  const profiles: AuthProfileInfo[] = [];
  const profileIds: string[] = [];

  for (const [id, profileConfig] of Object.entries(configProfiles)) {
    const email = profileConfig.email?.trim();
    const storeEntry = store.profiles[id];
    const storeEmail =
      storeEntry && "email" in storeEntry
        ? (storeEntry as { email?: string }).email?.trim()
        : undefined;

    profiles.push({
      id,
      provider: profileConfig.provider,
      email: email || storeEmail,
    });
    profileIds.push(id);
  }

  return { profiles, profileIds };
}

/**
 * Resolve /auth command reply (list mode - no args).
 */
export function resolveAuthListReply(params: {
  cfg: OpenClawConfig;
  surface?: string;
  currentAuthProfile?: string;
}): ReplyPayload {
  const { profiles } = buildAuthProfileData(params.cfg);
  const isTelegram = params.surface === "telegram";

  if (profiles.length === 0) {
    return { text: "No auth profiles configured." };
  }

  if (isTelegram) {
    const buttons = buildAuthProfileKeyboard({
      profiles,
      currentProfileId: params.currentAuthProfile,
    });
    const currentLabel = params.currentAuthProfile
      ? `Current: **${params.currentAuthProfile}**`
      : "Current: auto-rotate";
    return {
      text: `${currentLabel}\n\nSelect an auth profile:`,
      channelData: { telegram: { buttons } },
    };
  }

  // Text fallback for non-Telegram surfaces
  const lines: string[] = [
    "Auth Profiles:",
    ...profiles.map((p) => {
      const current = p.id === params.currentAuthProfile ? " ✓" : "";
      const email = p.email ? ` (${p.email})` : "";
      return `- ${p.id}${email} [${p.provider}]${current}`;
    }),
    "",
    params.currentAuthProfile ? `Current: ${params.currentAuthProfile}` : "Current: auto-rotate",
    "",
    "Switch: /auth <profile-id>",
    "Auto-rotate: /auth auto",
  ];
  return { text: lines.join("\n") };
}

export const handleAuthCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }

  const body = params.command.commandBodyNormalized.trim();
  if (!body.startsWith("/auth")) {
    return null;
  }

  const argText = body.replace(/^\/auth\b/i, "").trim();

  // No args → show list with buttons
  if (!argText) {
    const reply = resolveAuthListReply({
      cfg: params.cfg,
      surface: params.ctx.Surface,
      currentAuthProfile: params.sessionEntry?.authProfileOverride,
    });
    return { reply, shouldContinue: false };
  }

  // /auth auto → clear override
  if (argText.toLowerCase() === "auto") {
    if (params.sessionEntry && params.sessionStore && params.sessionKey) {
      delete params.sessionEntry.authProfileOverride;
      delete params.sessionEntry.authProfileOverrideSource;
      delete params.sessionEntry.authProfileOverrideCompactionCount;
      params.sessionEntry.updatedAt = Date.now();
      params.sessionStore[params.sessionKey] = params.sessionEntry;
      if (params.storePath) {
        await updateSessionStore(params.storePath, (store) => {
          if (store[params.sessionKey]) {
            delete store[params.sessionKey].authProfileOverride;
            delete store[params.sessionKey].authProfileOverrideSource;
            delete store[params.sessionKey].authProfileOverrideCompactionCount;
            store[params.sessionKey].updatedAt = Date.now();
          }
        });
      }
    }
    return {
      reply: { text: "Auth profile set to auto-rotate." },
      shouldContinue: false,
    };
  }

  // /auth <profileId> → set override
  const profileId = argText;
  const configProfiles = params.cfg.auth?.profiles;
  if (!configProfiles || !(profileId in configProfiles)) {
    const { profileIds } = buildAuthProfileData(params.cfg);
    const available = profileIds.length > 0 ? `\n\nAvailable: ${profileIds.join(", ")}` : "";
    return {
      reply: { text: `Unknown auth profile: ${profileId}${available}` },
      shouldContinue: false,
    };
  }

  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    params.sessionEntry.authProfileOverride = profileId;
    params.sessionEntry.authProfileOverrideSource = "user";
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        if (store[params.sessionKey]) {
          store[params.sessionKey].authProfileOverride = profileId;
          store[params.sessionKey].authProfileOverrideSource = "user";
          store[params.sessionKey].updatedAt = Date.now();
        }
      });
    }
  }

  const email = configProfiles[profileId]?.email?.trim();
  const label = email ? `${profileId} (${email})` : profileId;
  return {
    reply: { text: `Auth profile set to: **${label}**` },
    shouldContinue: false,
  };
};
