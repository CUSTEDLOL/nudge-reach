// Generation (vision call + photo upload) can take >10s; the server action
// runs under this route segment, so give it headroom on Vercel.
export const maxDuration = 60;

export default function NewCampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
