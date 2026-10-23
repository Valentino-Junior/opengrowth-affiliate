import { Flags } from "../_components/flags";

export default async function VerificationFlagsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <Flags view={view === "resolved" ? "resolved" : "open"} />;
}
