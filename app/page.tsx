import { ArsenalWorkspace } from "@/components/arsenal/ArsenalWorkspace";
import toolsData from "@/data/tools.json";
import { toolsDataSchema } from "@/lib/schema";

export default function Page() {
  const result = toolsDataSchema.safeParse(toolsData);

  if (!result.success) {
    throw new Error(
      `tools.json の形式が正しくありません: ${result.error.issues[0]?.message}`,
    );
  }

  return <ArsenalWorkspace categories={result.data.categories} />;
}
