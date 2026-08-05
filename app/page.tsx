import { ArsenalWorkspace } from "@/components/arsenal/ArsenalWorkspace";
import {
  hydrateToolClassification,
  isArsenalPublicMode,
  projectToolsForPublic,
} from "@/lib/arsenal-public";
import { loadToolsData } from "@/lib/load-tools-data";

export default function Page() {
  const data = loadToolsData();
  const publicMode = isArsenalPublicMode();
  const categories = publicMode
    ? projectToolsForPublic(data).categories
    : hydrateToolClassification(data).categories;

  return (
    <ArsenalWorkspace categories={categories} publicMode={publicMode} />
  );
}
