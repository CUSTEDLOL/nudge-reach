import Link from "next/link";
import type { BreadcrumbItem } from "@/modules/marketing/structured-data";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-ink/65">
        {items.map((item, index) => (
          <li key={item.path} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden>/</span> : null}
            <Link href={item.path} className="hover:text-ink">
              {item.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
