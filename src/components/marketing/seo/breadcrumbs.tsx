import Link from "next/link";
import type { BreadcrumbItem } from "@/modules/marketing/structured-data";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm text-ink/65">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li
              key={item.path}
              className="flex max-w-full min-w-0 items-start gap-2"
            >
              {index > 0 ? (
                <span aria-hidden className="shrink-0">
                  /
                </span>
              ) : null}
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="min-w-0 break-words text-ink"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className="min-w-0 break-words hover:text-ink"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
