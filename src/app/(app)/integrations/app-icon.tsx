import {
  Bell,
  Camera,
  CalendarDays,
  Cloud,
  Code2,
  CreditCard,
  Database,
  GitBranch,
  Globe,
  IndianRupee,
  MessageCircle,
  MessagesSquare,
  ShoppingBag,
  ShoppingCart,
  Table,
  Target,
  TrendingUp,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * One tinted square per app. Deliberately our own icon set rather than
 * scraped brand logos: consistent at every size, no trademark questions,
 * and it survives an app renaming itself.
 */
const ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  globe: Globe,
  calendar: CalendarDays,
  database: Database,
  cloud: Cloud,
  target: Target,
  trending: TrendingUp,
  zap: Zap,
  workflow: Workflow,
  branch: GitBranch,
  bell: Bell,
  table: Table,
  rupee: IndianRupee,
  card: CreditCard,
  webhook: Webhook,
  code: Code2,
  bag: ShoppingBag,
  cart: ShoppingCart,
  camera: Camera,
  messages: MessagesSquare,
};

export function AppIcon({
  icon,
  accent,
  className,
}: {
  icon: string;
  accent: string;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? Globe;
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
        accent,
        className
      )}
    >
      <Icon className="h-[22px] w-[22px]" />
    </span>
  );
}
