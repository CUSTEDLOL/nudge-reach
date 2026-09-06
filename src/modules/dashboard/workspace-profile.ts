export const ROLE_OPTIONS = [
  {
    value: "owner",
    label: "Owner or operator",
    description: "I oversee the business and want the full picture.",
  },
  {
    value: "manager",
    label: "Manager",
    description: "I coordinate a team and keep daily operations moving.",
  },
  {
    value: "sales",
    label: "Sales",
    description: "I qualify leads, follow up, and close bookings.",
  },
  {
    value: "front-desk",
    label: "Front desk",
    description: "I handle conversations, appointments, and handoffs.",
  },
  {
    value: "support",
    label: "Customer support",
    description: "I answer questions and resolve customer issues.",
  },
  {
    value: "admin",
    label: "Administrator",
    description: "I configure systems, permissions, and integrations.",
  },
] as const;

export const OUTCOME_OPTIONS = [
  {
    value: "bookings",
    label: "Book more customers",
    description: "Turn more WhatsApp enquiries into confirmed appointments.",
  },
  {
    value: "faster-responses",
    label: "Reply faster",
    description: "Make sure every new enquiry gets an immediate answer.",
  },
  {
    value: "follow-up",
    label: "Stop losing quiet leads",
    description: "Consistently follow up when a promising lead goes silent.",
  },
  {
    value: "fewer-no-shows",
    label: "Reduce no-shows",
    description: "Confirm appointments and recover missed bookings.",
  },
  {
    value: "payments",
    label: "Collect payments",
    description: "Make deposits and outstanding payments easier to track.",
  },
  {
    value: "support",
    label: "Handle customer questions",
    description: "Resolve routine questions and surface the difficult ones.",
  },
] as const;

export const JOURNEY_OPTIONS = [
  {
    value: "enquiry-booking-payment",
    label: "Enquiry → booking → payment",
    description: "Customers enquire, choose a slot, and pay or confirm.",
  },
  {
    value: "consultation-booking",
    label: "Enquiry → consultation → booking",
    description: "A consultation or qualification step happens before booking.",
  },
  {
    value: "quote-follow-up",
    label: "Enquiry → quote → follow-up",
    description: "Customers compare options and usually need follow-up.",
  },
  {
    value: "support-repeat",
    label: "Question → service → repeat visit",
    description: "Existing customers return for help and ongoing service.",
  },
] as const;

export const TEAM_OPTIONS = [
  {
    value: "solo",
    label: "Just me",
    description: "I handle most customer and business decisions myself.",
  },
  {
    value: "small-team",
    label: "A small shared team",
    description: "A few people share the inbox and customer follow-up.",
  },
  {
    value: "departments",
    label: "Structured departments",
    description: "Different teams own sales, service, and administration.",
  },
] as const;

export const SYSTEM_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp Business" },
  { value: "google-calendar", label: "Google Calendar" },
  { value: "crm", label: "CRM" },
  { value: "payments", label: "Payment links" },
  { value: "spreadsheets", label: "Spreadsheets" },
  { value: "none", label: "None yet" },
] as const;

export const GUIDANCE_OPTIONS = [
  {
    value: "guided",
    label: "Guide me step by step",
    description: "Explain what to do next and keep advanced controls quieter.",
  },
  {
    value: "balanced",
    label: "Show guidance when useful",
    description: "Keep the workspace concise with context where it matters.",
  },
  {
    value: "direct",
    label: "Take me straight to the controls",
    description: "Use a denser view with less explanation.",
  },
] as const;

type OptionValue<T extends readonly { value: string }[]> = T[number]["value"];

export type WorkspaceRole = OptionValue<typeof ROLE_OPTIONS>;
export type PrimaryOutcome = OptionValue<typeof OUTCOME_OPTIONS>;
export type CustomerJourney = OptionValue<typeof JOURNEY_OPTIONS>;
export type TeamShape = OptionValue<typeof TEAM_OPTIONS>;
export type ConnectedSystem = OptionValue<typeof SYSTEM_OPTIONS>;
export type GuidanceLevel = OptionValue<typeof GUIDANCE_OPTIONS>;

export type AttentionKind =
  | "handoff"
  | "owner-question"
  | "unread"
  | "booking"
  | "payment"
  | "followup"
  | "setup";

export type ShortcutKey =
  | "today"
  | "inbox"
  | "leads"
  | "front-desk"
  | "followups"
  | "campaigns"
  | "analytics"
  | "integrations"
  | "settings";

export type SetupTaskKey =
  | "teach-front-desk"
  | "try-front-desk"
  | "connect-whatsapp"
  | "connect-calendar"
  | "import-contacts"
  | "configure-followups";

export interface WorkspaceProfile {
  version: 1;
  role: WorkspaceRole;
  primaryOutcome: PrimaryOutcome;
  journey: CustomerJourney;
  teamShape: TeamShape;
  systems: ConnectedSystem[];
  guidance: GuidanceLevel;
  lastCompletedStep: number;
}

export type WorkspaceProfilePatch = Partial<Omit<WorkspaceProfile, "version">>;

export interface WorkspaceDefaults {
  attentionOrder: AttentionKind[];
  shortcuts: ShortcutKey[];
  setupOrder: SetupTaskKey[];
  showSectionDescriptions: boolean;
}

export interface UiPreferences {
  sidebarCollapsed: boolean;
  pinnedShortcuts: ShortcutKey[];
}

export const DEFAULT_WORKSPACE_PROFILE: WorkspaceProfile = {
  version: 1,
  role: "owner",
  primaryOutcome: "bookings",
  journey: "enquiry-booking-payment",
  teamShape: "solo",
  systems: [],
  guidance: "guided",
  lastCompletedStep: 0,
};

const ROLE_VALUES: ReadonlySet<string> = new Set(
  ROLE_OPTIONS.map((option) => option.value)
);
const OUTCOME_VALUES: ReadonlySet<string> = new Set(
  OUTCOME_OPTIONS.map((option) => option.value)
);
const JOURNEY_VALUES: ReadonlySet<string> = new Set(
  JOURNEY_OPTIONS.map((option) => option.value)
);
const TEAM_VALUES: ReadonlySet<string> = new Set(
  TEAM_OPTIONS.map((option) => option.value)
);
const SYSTEM_VALUES: ReadonlySet<string> = new Set(
  SYSTEM_OPTIONS.map((option) => option.value)
);
const GUIDANCE_VALUES: ReadonlySet<string> = new Set(
  GUIDANCE_OPTIONS.map((option) => option.value)
);
const SHORTCUT_VALUES = new Set<ShortcutKey>([
  "today",
  "inbox",
  "leads",
  "front-desk",
  "followups",
  "campaigns",
  "analytics",
  "integrations",
  "settings",
]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function allowed<T extends string>(
  value: unknown,
  values: ReadonlySet<string>,
  fallback: T
): T {
  return typeof value === "string" && values.has(value)
    ? (value as T)
    : fallback;
}

function parseSystems(value: unknown): ConnectedSystem[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (item): item is ConnectedSystem =>
          typeof item === "string" && SYSTEM_VALUES.has(item)
      )
    )
  );
}

function parseStep(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 8
    ? value
    : 0;
}

export function parseWorkspaceProfile(settings: unknown): WorkspaceProfile {
  const source = record(record(settings).workspaceProfile);
  return {
    version: 1,
    role: allowed(source.role, ROLE_VALUES, DEFAULT_WORKSPACE_PROFILE.role),
    primaryOutcome: allowed(
      source.primaryOutcome,
      OUTCOME_VALUES,
      DEFAULT_WORKSPACE_PROFILE.primaryOutcome
    ),
    journey: allowed(
      source.journey,
      JOURNEY_VALUES,
      DEFAULT_WORKSPACE_PROFILE.journey
    ),
    teamShape: allowed(
      source.teamShape,
      TEAM_VALUES,
      DEFAULT_WORKSPACE_PROFILE.teamShape
    ),
    systems: parseSystems(source.systems),
    guidance: allowed(
      source.guidance,
      GUIDANCE_VALUES,
      DEFAULT_WORKSPACE_PROFILE.guidance
    ),
    lastCompletedStep: parseStep(source.lastCompletedStep),
  };
}

export function parseWorkspaceProfilePatch(input: unknown): WorkspaceProfilePatch {
  const source = record(input);
  const patch: WorkspaceProfilePatch = {};

  if ("role" in source) {
    if (typeof source.role !== "string" || !ROLE_VALUES.has(source.role)) {
      throw new Error("Choose a valid role.");
    }
    patch.role = source.role as WorkspaceRole;
  }
  if ("primaryOutcome" in source) {
    if (
      typeof source.primaryOutcome !== "string" ||
      !OUTCOME_VALUES.has(source.primaryOutcome)
    ) {
      throw new Error("Choose a valid primary outcome.");
    }
    patch.primaryOutcome = source.primaryOutcome as PrimaryOutcome;
  }
  if ("journey" in source) {
    if (typeof source.journey !== "string" || !JOURNEY_VALUES.has(source.journey)) {
      throw new Error("Choose a valid customer journey.");
    }
    patch.journey = source.journey as CustomerJourney;
  }
  if ("teamShape" in source) {
    if (typeof source.teamShape !== "string" || !TEAM_VALUES.has(source.teamShape)) {
      throw new Error("Choose a valid team shape.");
    }
    patch.teamShape = source.teamShape as TeamShape;
  }
  if ("systems" in source) {
    const systems = parseSystems(source.systems);
    if (
      !Array.isArray(source.systems) ||
      systems.length !== source.systems.length ||
      (systems.includes("none") && systems.length > 1)
    ) {
      throw new Error("Choose a valid combination of systems.");
    }
    patch.systems = systems;
  }
  if ("guidance" in source) {
    if (
      typeof source.guidance !== "string" ||
      !GUIDANCE_VALUES.has(source.guidance)
    ) {
      throw new Error("Choose a valid guidance level.");
    }
    patch.guidance = source.guidance as GuidanceLevel;
  }
  if ("lastCompletedStep" in source) {
    const step = parseStep(source.lastCompletedStep);
    if (step !== source.lastCompletedStep) {
      throw new Error("Choose a valid onboarding step.");
    }
    patch.lastCompletedStep = step;
  }

  return patch;
}

export function mergeWorkspaceProfile(
  settings: unknown,
  input: unknown
): Record<string, unknown> {
  const currentSettings = record(settings);
  const currentProfile = parseWorkspaceProfile(settings);
  const patch = parseWorkspaceProfilePatch(input);
  return {
    ...currentSettings,
    workspaceProfile: { ...currentProfile, ...patch, version: 1 },
  };
}

const ATTENTION_BY_OUTCOME: Record<PrimaryOutcome, AttentionKind[]> = {
  bookings: [
    "handoff",
    "owner-question",
    "booking",
    "unread",
    "payment",
    "followup",
    "setup",
  ],
  "faster-responses": [
    "handoff",
    "unread",
    "owner-question",
    "booking",
    "payment",
    "followup",
    "setup",
  ],
  "follow-up": [
    "handoff",
    "owner-question",
    "followup",
    "unread",
    "booking",
    "payment",
    "setup",
  ],
  "fewer-no-shows": [
    "handoff",
    "booking",
    "followup",
    "owner-question",
    "unread",
    "payment",
    "setup",
  ],
  payments: [
    "handoff",
    "owner-question",
    "payment",
    "unread",
    "booking",
    "followup",
    "setup",
  ],
  support: [
    "handoff",
    "owner-question",
    "unread",
    "booking",
    "payment",
    "followup",
    "setup",
  ],
};

const SHORTCUTS_BY_OUTCOME: Record<PrimaryOutcome, ShortcutKey[]> = {
  bookings: ["front-desk", "inbox", "integrations"],
  "faster-responses": ["inbox", "front-desk", "leads"],
  "follow-up": ["followups", "inbox", "front-desk"],
  "fewer-no-shows": ["followups", "front-desk", "inbox"],
  payments: ["inbox", "front-desk", "integrations"],
  support: ["inbox", "front-desk", "leads"],
};

const SHORTCUTS_BY_ROLE: Record<WorkspaceRole, ShortcutKey[]> = {
  owner: [],
  manager: ["today"],
  sales: ["leads"],
  "front-desk": ["inbox"],
  support: ["inbox"],
  admin: ["integrations", "settings"],
};

const SHORTCUTS_BY_TEAM: Record<TeamShape, ShortcutKey[]> = {
  solo: [],
  "small-team": ["inbox"],
  departments: ["analytics"],
};

const ATTENTION_BY_JOURNEY: Record<CustomerJourney, AttentionKind> = {
  "enquiry-booking-payment": "booking",
  "consultation-booking": "owner-question",
  "quote-follow-up": "followup",
  "support-repeat": "unread",
};

const SETUP_BY_OUTCOME: Partial<Record<PrimaryOutcome, SetupTaskKey>> = {
  bookings: "connect-calendar",
  "follow-up": "configure-followups",
  "fewer-no-shows": "configure-followups",
};

const SETUP_BY_JOURNEY: Record<CustomerJourney, SetupTaskKey> = {
  "enquiry-booking-payment": "connect-calendar",
  "consultation-booking": "connect-calendar",
  "quote-follow-up": "configure-followups",
  "support-repeat": "teach-front-desk",
};

const SETUP_BY_SYSTEM: Partial<Record<ConnectedSystem, SetupTaskKey>> = {
  whatsapp: "connect-whatsapp",
  "google-calendar": "connect-calendar",
  crm: "import-contacts",
  spreadsheets: "import-contacts",
  none: "connect-whatsapp",
};

const DEFAULT_SETUP_ORDER: SetupTaskKey[] = [
  "teach-front-desk",
  "try-front-desk",
  "connect-whatsapp",
  "connect-calendar",
  "import-contacts",
  "configure-followups",
];

export function deriveWorkspaceDefaults(
  profile: WorkspaceProfile
): WorkspaceDefaults {
  const unique = <T extends string>(items: T[]): T[] => Array.from(new Set(items));
  const attentionOrder = [...ATTENTION_BY_OUTCOME[profile.primaryOutcome]];
  const journeyPriority = ATTENTION_BY_JOURNEY[profile.journey];
  const journeyIndex = attentionOrder.indexOf(journeyPriority);
  if (journeyIndex > 3) {
    attentionOrder.splice(journeyIndex, 1);
    attentionOrder.splice(3, 0, journeyPriority);
  }

  const shortcuts = unique([
    ...SHORTCUTS_BY_ROLE[profile.role],
    ...SHORTCUTS_BY_TEAM[profile.teamShape],
    ...SHORTCUTS_BY_OUTCOME[profile.primaryOutcome],
  ]).slice(0, 3);

  const setupPriorities = [
    SETUP_BY_OUTCOME[profile.primaryOutcome],
    SETUP_BY_JOURNEY[profile.journey],
    ...profile.systems.map((system) => SETUP_BY_SYSTEM[system]),
  ].filter((task): task is SetupTaskKey => task !== undefined);
  const setupOrder = [
    "teach-front-desk" as const,
    "try-front-desk" as const,
    ...unique([
      ...setupPriorities.filter(
        (task) => task !== "teach-front-desk" && task !== "try-front-desk"
      ),
      ...DEFAULT_SETUP_ORDER.filter(
        (task) => task !== "teach-front-desk" && task !== "try-front-desk"
      ),
    ]),
  ];

  return {
    attentionOrder,
    shortcuts,
    setupOrder,
    showSectionDescriptions: profile.guidance !== "direct",
  };
}

export function parseUiPreferences(value: unknown): UiPreferences {
  const source = record(value);
  const rawShortcuts = Array.isArray(source.pinnedShortcuts)
    ? source.pinnedShortcuts
    : [];
  const pinnedShortcuts = Array.from(
    new Set(
      rawShortcuts.filter(
        (item): item is ShortcutKey =>
          typeof item === "string" && SHORTCUT_VALUES.has(item as ShortcutKey)
      )
    )
  );
  return {
    sidebarCollapsed: source.sidebarCollapsed === true,
    pinnedShortcuts,
  };
}

export function mergeUiPreferences(
  current: unknown,
  patch: Partial<UiPreferences>
): UiPreferences {
  return parseUiPreferences({ ...parseUiPreferences(current), ...patch });
}
