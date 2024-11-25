import { Handlers, PageProps } from "$fresh/server.ts";
import { DinoData } from "../types.ts";
import { Effect } from "effect";

// Define custom error types for better error handling
class DinoNotFoundError {
  readonly _tag = "DinoNotFoundError";
  constructor(readonly name: string) {}
}

class FileReadError {
  readonly _tag = "FileReadError";
  constructor(readonly error: unknown) {}
}

// Create reusable Effect functions
const readDinoFile = Effect.tryPromise({
  try: () => Deno.readTextFile("data/dinosaurs.json"),
  catch: (error) => new FileReadError(error)
});

const parseDinos = (data: string) => Effect.try({
  try: () => JSON.parse(data) as DinoData[],
  catch: (error) => new FileReadError(error)
});

const findDino = (name: string) => (dinos: DinoData[]) =>
  Effect.fromNullable(
    dinos.find((d) => d.name.toLowerCase() === name.toLowerCase())
  ).pipe(Effect.mapError(() => new DinoNotFoundError(name)));

// Main handler using Effect.gen for better control flow
export const handler: Handlers<DinoData | null> = {
  async GET(_req, ctx) {
    const program = Effect.gen(function* (_) {
      const fileData = yield* readDinoFile;
      const dinos = yield* parseDinos(fileData);
      const dino = yield* findDino(ctx.params.dinosaur)(dinos);
      return dino;
    });

    // Run the effect and handle potential errors
    const result = await Effect.runPromise(
      program.pipe(
        Effect.catchAll((error) => {
          console.error('Error fetching dinosaur:', error);
          return Effect.succeed(null);
        })
      )
    );

    return ctx.render(result);
  },
};

export default function DinoPage({ data: dino }: PageProps<DinoData | null>) {
  if (!dino) {
    return <h1>Dinosaur not found</h1>;
  }

  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold mb-4">{dino.name}</h1>
      <p class="my-4">{dino.description}</p>
      <a href="/" class="text-blue-600 hover:underline">
        Back to all dinosaurs
      </a>
    </main>
  );
}