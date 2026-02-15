import { describe, expect, it } from "vitest";
import {
  parseAuthCallbackData,
  buildAuthProfileKeyboard,
  type AuthProfileInfo,
} from "./auth-buttons.js";

describe("parseAuthCallbackData", () => {
  it("returns null for non-auth data", () => {
    expect(parseAuthCallbackData("mdl_prov")).toBeNull();
    expect(parseAuthCallbackData("")).toBeNull();
    expect(parseAuthCallbackData("something")).toBeNull();
  });

  it("parses auth_list", () => {
    expect(parseAuthCallbackData("auth_list")).toEqual({ type: "list" });
  });

  it("parses auth_clear", () => {
    expect(parseAuthCallbackData("auth_clear")).toEqual({ type: "clear" });
  });

  it("parses auth_sel_<profileId>", () => {
    expect(parseAuthCallbackData("auth_sel_my-profile")).toEqual({
      type: "select",
      profileId: "my-profile",
    });
  });

  it("parses profile ids with special characters", () => {
    expect(parseAuthCallbackData("auth_sel_emre@anthropic")).toEqual({
      type: "select",
      profileId: "emre@anthropic",
    });
  });

  it("trims whitespace", () => {
    expect(parseAuthCallbackData("  auth_list  ")).toEqual({ type: "list" });
  });

  it("returns null for auth_sel_ with no id", () => {
    expect(parseAuthCallbackData("auth_sel_")).toBeNull();
  });
});

describe("buildAuthProfileKeyboard", () => {
  it("returns empty array for no profiles", () => {
    expect(buildAuthProfileKeyboard({ profiles: [], currentProfileId: undefined })).toEqual([]);
  });

  it("builds buttons for profiles with auto-rotate row", () => {
    const profiles: AuthProfileInfo[] = [
      { id: "profile-a", provider: "anthropic", email: "a@test.com" },
      { id: "profile-b", provider: "openai" },
    ];
    const rows = buildAuthProfileKeyboard({ profiles, currentProfileId: "profile-a" });

    // 2 profile rows + 1 auto-rotate row
    expect(rows).toHaveLength(3);
    expect(rows[0][0].text).toContain("profile-a");
    expect(rows[0][0].text).toContain("✓");
    expect(rows[0][0].callback_data).toBe("auth_sel_profile-a");
    expect(rows[1][0].text).toBe("profile-b");
    expect(rows[1][0].callback_data).toBe("auth_sel_profile-b");
    expect(rows[2][0].text).toContain("Auto-rotate");
    expect(rows[2][0].callback_data).toBe("auth_clear");
  });

  it("marks auto-rotate as current when no profile is selected", () => {
    const profiles: AuthProfileInfo[] = [{ id: "p1", provider: "anthropic" }];
    const rows = buildAuthProfileKeyboard({ profiles, currentProfileId: undefined });
    const autoRow = rows.at(-1);
    expect(autoRow?.[0].text).toContain("✓");
  });
});
