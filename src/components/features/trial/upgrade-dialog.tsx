"use client";

import Link from "next/link";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function UpgradeDialogActions({ featureName }: { featureName: string }) {
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      <BookDemoButton surface="trial_workspace" variant="primary" size="md">
        Book a free demo
      </BookDemoButton>
      <Link href="/pricing" className={buttonVariants({ variant: "secondary" })}>
        See paid plans
      </Link>
      <span className="sr-only">Unlock {featureName}</span>
    </div>
  );
}

export function UpgradeDialog({
  open,
  onClose,
  featureName,
}: {
  open: boolean;
  onClose: () => void;
  featureName: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Unlock ${featureName}`}
      description="This preview becomes a real business action after your WhatsApp and systems are set up."
      size="sm"
      footer={<UpgradeDialogActions featureName={featureName} />}
    >
      <p className="text-sm leading-6 text-neutral-600">
        Book a free demo and we will show you how this fits your business, or compare the paid plans first.
      </p>
    </Modal>
  );
}
