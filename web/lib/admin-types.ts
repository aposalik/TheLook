export type AdminRenderSettings = {
  realTryonEnabled: boolean;
  verifiedAccountRequired: boolean;
  userDailyTryonLimit: number;
  globalDailyTryonLimit: number;
  globalTotalUnitLimit: number;
  ipDailyObserveThreshold: number;
};

export type AdminUserSummary = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  provider: string;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
};

export type AdminRenderSummary = {
  id: string;
  userId: string;
  status: string;
  selectedItemCount: number;
  youcamUnits: number;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AdminWardrobeSummary = {
  id: string;
  userId: string;
  title: string;
  category: string;
  layer: string | null;
  createdAt: string;
};

export type AdminAuditSummary = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  createdAt: string;
};

export type AdminSnapshot = {
  generatedAt: string;
  warnings: string[];
  actor: { id: string; email: string | null };
  counts: {
    users: number;
    permanentUsers: number;
    anonymousUsers: number;
    wardrobeItems: number;
    savedLooks: number;
    feedbackEvents: number;
    renderJobs: number;
    completedRenders: number;
    failedRenders: number;
  };
  usage: {
    todayRenders: number;
    todayUnits: number;
    totalUnits: number;
  };
  settings: AdminRenderSettings;
  integrations: {
    supabase: boolean;
    gemini: boolean;
    youcam: boolean;
    weather: boolean;
  };
  users: AdminUserSummary[];
  renders: AdminRenderSummary[];
  wardrobe: AdminWardrobeSummary[];
  audit: AdminAuditSummary[];
};
