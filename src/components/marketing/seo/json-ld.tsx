interface JsonLdProps {
  value: Record<string, unknown>;
}

export function JsonLd({ value }: JsonLdProps) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");

  return <script type="application/ld+json">{json}</script>;
}
