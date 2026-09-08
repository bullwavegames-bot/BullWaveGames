export type GameAPI = {
  slug: string;
  muted: boolean;
  reduced: boolean;
  continues: number;
  onContinue: () => boolean;
  onFinish: (result: { score: number; stars: number; metric?: string }) => void;
};
