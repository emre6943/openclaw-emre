/**
 * Telegram inline button utilities for auth profile selection.
 *
 * Callback data patterns (max 64 bytes for Telegram):
 * - auth_list             - show all auth profiles
 * - auth_sel_{profileId}  - select auth profile
 * - auth_clear            - clear auth profile override (auto-rotate)
 */

export type ButtonRow = Array<{ text: string; callback_data: string }>;

export type ParsedAuthCallback =
  | { type: "list" }
  | { type: "select"; profileId: string }
  | { type: "clear" };

const MAX_CALLBACK_DATA_BYTES = 64;

/**
 * Parse an auth callback_data string into a structured object.
 * Returns null if the data doesn't match a known pattern.
 */
export function parseAuthCallbackData(data: string): ParsedAuthCallback | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith("auth_")) {
    return null;
  }

  if (trimmed === "auth_list") {
    return { type: "list" };
  }

  if (trimmed === "auth_clear") {
    return { type: "clear" };
  }

  const selMatch = trimmed.match(/^auth_sel_(.+)$/);
  if (selMatch) {
    const profileId = selMatch[1];
    if (profileId) {
      return { type: "select", profileId };
    }
  }

  return null;
}

export type AuthProfileInfo = {
  id: string;
  provider: string;
  email?: string;
};

/**
 * Build auth profile selection keyboard with one profile per row.
 */
export function buildAuthProfileKeyboard(params: {
  profiles: AuthProfileInfo[];
  currentProfileId?: string;
}): ButtonRow[] {
  const { profiles, currentProfileId } = params;

  if (profiles.length === 0) {
    return [];
  }

  const rows: ButtonRow[] = [];

  for (const profile of profiles) {
    const callbackData = `auth_sel_${profile.id}`;
    // Skip profiles that would exceed Telegram's callback_data limit
    if (Buffer.byteLength(callbackData, "utf8") > MAX_CALLBACK_DATA_BYTES) {
      continue;
    }

    const isCurrent = profile.id === currentProfileId;
    const label = profile.email ? `${profile.id} (${profile.email})` : profile.id;
    const displayText = truncateLabel(label, 38);
    const text = isCurrent ? `${displayText} ✓` : displayText;

    rows.push([
      {
        text,
        callback_data: callbackData,
      },
    ]);
  }

  // Auto-rotate button (clears override)
  rows.push([
    { text: currentProfileId ? "🔄 Auto-rotate" : "🔄 Auto-rotate ✓", callback_data: "auth_clear" },
  ]);

  return rows;
}

/**
 * Truncate label for display, preserving end if too long.
 */
function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) {
    return label;
  }
  return `…${label.slice(-(maxLen - 1))}`;
}
