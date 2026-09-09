export type ProfileRole = "player" | "admin";

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_id: string;
  avatar_url: string | null;
  onboarding_complete: boolean;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
};
