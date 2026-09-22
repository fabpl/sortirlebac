/**
 * Sonde temporaire : identifie ce que le runtime Vercel sait charger.
 *
 * Aucun import statique, tout est tenté dynamiquement dans un try/catch — de
 * sorte que la fonction se charge toujours et rapporte les échecs au lieu de
 * planter avant d'exister. À supprimer une fois le diagnostic fait.
 */

export async function GET(): Promise<Response> {
  const rapport: Record<string, unknown> = {
    node: process.version,
    cwd: process.cwd(),
  };

  const essayer = async (cle: string, action: () => Promise<unknown>) => {
    try {
      rapport[cle] = await action();
    } catch (cause) {
      rapport[cle] = `ÉCHEC — ${cause instanceof Error ? cause.message : String(cause)}`;
    }
  };

  await essayer("import .ts", async () =>
    typeof (await import("../lib/temps.ts")).aujourdhuiAParis);

  // Spécificateurs construits à l'exécution : TypeScript ne les résout pas,
  // ce qui est justement le but — on veut savoir ce que le runtime accepte.
  const dynamique = (chemin: string) => import(/* @vite-ignore */ chemin);

  await essayer("import .js", async () =>
    typeof (await dynamique("../lib/temps.js")).aujourdhuiAParis);

  await essayer("import sans extension", async () =>
    typeof (await dynamique("../lib/temps")).aujourdhuiAParis);

  await essayer("json avec attribut", async () => {
    const module = await import("../public/secteurs.json", { with: { type: "json" } });
    return Object.keys(module.default as object);
  });

  await essayer("fichiers présents", async () => {
    const { readdirSync } = await import("node:fs");
    const racine = readdirSync(process.cwd());
    return {
      racine: racine.slice(0, 30),
      lib: racine.includes("lib") ? readdirSync(`${process.cwd()}/lib`) : "absent",
      public: racine.includes("public")
        ? readdirSync(`${process.cwd()}/public`).slice(0, 10) : "absent",
    };
  });

  return Response.json(rapport, {
    headers: { "Cache-Control": "no-store" },
  });
}
