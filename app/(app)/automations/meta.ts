import {
  CheckCircle2,
  Clock,
  FileText,
  Hand,
  MessageCircle,
  MessageSquare,
  Megaphone,
  Tag,
  TrendingUp,
  UserCheck,
  UserPlus,
  WholeWord,
  type LucideIcon,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
import {
  AUTOMATION_TRIGGERS,
  STEP_KINDS,
  STEP_LABELS,
  TRIGGER_LABELS,
  type AutomationTrigger,
  type StepKind,
} from "@/lib/automation/definitions";

/**
 * Display metadata for triggers and step kinds — shared by the list page
 * (server) and the builder/runs components (client). Pure module: safe to
 * import from either side.
 */

export interface TriggerMeta {
  value: AutomationTrigger;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: BadgeTone;
}

const TRIGGER_DETAILS: Record<
  AutomationTrigger,
  { description: string; icon: LucideIcon; tone: BadgeTone }
> = {
  message_received: {
    description: "Any inbound WhatsApp message from a customer.",
    icon: MessageCircle,
    tone: "info",
  },
  keyword: {
    description: "An inbound message matches your keywords.",
    icon: WholeWord,
    tone: "brand",
  },
  contact_created: {
    description: "A new contact is added or imported.",
    icon: UserPlus,
    tone: "success",
  },
  tag_added: {
    description: "A tag is added to a contact.",
    icon: Tag,
    tone: "warning",
  },
  campaign_reply: {
    description: "A contact replies within 7 days of a campaign.",
    icon: Megaphone,
    tone: "brand",
  },
};

export const TRIGGER_META: TriggerMeta[] = AUTOMATION_TRIGGERS.map((value) => ({
  value,
  label: TRIGGER_LABELS[value],
  ...TRIGGER_DETAILS[value],
}));

export function triggerMeta(trigger: string): TriggerMeta {
  return (
    TRIGGER_META.find((t) => t.value === trigger) ?? {
      value: "message_received",
      label: trigger,
      description: "",
      icon: MessageCircle,
      tone: "neutral",
    }
  );
}

export interface StepMeta {
  value: StepKind;
  label: string;
  description: string;
  icon: LucideIcon;
}

const STEP_DETAILS: Record<StepKind, { description: string; icon: LucideIcon }> = {
  send_message: {
    description: "Free-form reply (inside the 24h service window).",
    icon: MessageSquare,
  },
  send_template: {
    description: "Approved template — {{1}} becomes the first name.",
    icon: FileText,
  },
  add_tag: { description: "Label the contact with a tag.", icon: Tag },
  assign_agent: {
    description: "Route the contact + thread to a teammate.",
    icon: UserCheck,
  },
  update_lead_stage: {
    description: "Move the contact along your pipeline.",
    icon: TrendingUp,
  },
  wait: { description: "Pause the run for a number of minutes.", icon: Clock },
  resolve_conversation: {
    description: "Mark the conversation resolved.",
    icon: CheckCircle2,
  },
  handoff_to_human: {
    description: "Flag the conversation for a human.",
    icon: Hand,
  },
};

export const STEP_META: StepMeta[] = STEP_KINDS.map((value) => ({
  value,
  label: STEP_LABELS[value],
  ...STEP_DETAILS[value],
}));

export function stepMeta(kind: string): StepMeta {
  return (
    STEP_META.find((s) => s.value === kind) ?? {
      value: "send_message",
      label: kind,
      description: "",
      icon: MessageSquare,
    }
  );
}
