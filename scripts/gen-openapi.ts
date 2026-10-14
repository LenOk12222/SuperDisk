/**
 * Генерирует openapi.yaml из единого источника src/lib/openapi-spec.ts
 * (spec-first подход: спека — контракт, реализация следует ей).
 *
 *   npx tsx scripts/gen-openapi.ts
 */
import { writeFileSync } from "node:fs";
import YAML from "yaml";
import { OPENAPI_SPEC } from "../src/lib/openapi-spec";

writeFileSync(
  "openapi.yaml",
  `${"# SETKA API — сгенерировано из src/lib/openapi-spec.ts, не редактируйте вручную\n"}${YAML.stringify(OPENAPI_SPEC, { indent: 2, lineWidth: 100 })}`,
);
console.log("openapi.yaml обновлён");
