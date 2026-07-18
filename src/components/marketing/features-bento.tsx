import { ArrowRight } from "lucide-react";
import { ButtonLink } from "./button";
import { BookDemoButton } from "./book-demo";
import { Container, Section } from "./section";
import { FeatureScenes } from "./feature-scenes";

/** The daylight hand-off after the Night Shift story: the five product
 * capabilities behind the Front Desk — all visible, with no hover gate. */
export function FeaturesBento() {
  return (
    <Section id="features" className="bg-white">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            One employee.
            <span className="serif-display mt-3 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Everything it works with.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            The full toolkit behind the Front Desk — the agent, the outreach,
            the numbers and the plumbing.
          </p>
        </div>

        <FeatureScenes />

        <div className="mt-12 flex flex-col items-center gap-5 text-center">
          <p className="max-w-xl text-[15px] text-ink/60">
            We configure the{" "}
            <strong className="font-bold text-ink">
              knowledge, flows, templates and integrations
            </strong>{" "}
            for you — that&rsquo;s the &lsquo;done-for-you&rsquo; part.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <BookDemoButton variant="primary">
              Book a Demo
              <ArrowRight className="h-4 w-4" />
            </BookDemoButton>
            <ButtonLink href="/pricing" variant="secondary">
              See pricing
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
