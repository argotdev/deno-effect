import { Handlers, PageProps } from "$fresh/server.ts";
import { DinoData } from "../types.ts";
import { Effect } from "effect";

// Custom error types for better error handling
class FileReadError {
  readonly _tag = "FileReadError";
  constructor(readonly error: unknown) {}
}

class ParseError {
  readonly _tag = "ParseError";
  constructor(readonly error: unknown) {}
}

class DataFormatError {
  readonly _tag = "DataFormatError";
  constructor(readonly message: string) {}
}

// Effect-based operations
const readDinoFile = Effect.tryPromise({
  try: () => Deno.readTextFile("data/dinosaurs.json"),
  catch: (error) => new FileReadError(error)
});

const parseDinoData = (data: string) => Effect.try({
  try: () => JSON.parse(data),
  catch: (error) => new ParseError(error)
});

// Fixed typing for validateDinoArray
const validateDinoArray = (data: unknown): Effect.Effect<DinoData[], DataFormatError> => {
  if (!Array.isArray(data)) {
    return Effect.fail(new DataFormatError("Data is not in expected array format"));
  }
  
  // Optional: Add additional type validation for each dinosaur object
  const isValidDinoData = (item: unknown): item is DinoData => {
    return typeof item === 'object' 
      && item !== null 
      && 'name' in item 
      && typeof (item as DinoData).name === 'string'
      && 'description' in item 
      && typeof (item as DinoData).description === 'string';
  };

  if (!data.every(isValidDinoData)) {
    return Effect.fail(new DataFormatError("Some items in array are not valid DinoData"));
  }

  return Effect.succeed(data);
};

// Main handler using Effect.gen for better control flow
export const handler: Handlers<DinoData[]> = {
  async GET(_req, ctx) {
    const program = Effect.gen(function* (_) {
      // Read file
      const fileContent = yield* readDinoFile;
      
      // Parse JSON
      const parsedData = yield* parseDinoData(fileContent);
      
      // Validate array format and contents
      const dinos = yield* validateDinoArray(parsedData);
      
      return dinos;
    });

    // Run the effect and handle all potential errors
    const result = await Effect.runPromise(
      program.pipe(
        Effect.catchAll((error) => {
          // Log different error types appropriately
          switch (error._tag) {
            case "FileReadError":
              console.error("Error reading dinosaur file:", error.error);
              break;
            case "ParseError":
              console.error("Error parsing dinosaur data:", error.error);
              break;
            case "DataFormatError":
              console.error("Data format error:", error.message);
              break;
          }
          // Return empty array as fallback
          return Effect.succeed<DinoData[]>([]);
        })
      )
    );

    return ctx.render(result);
  },
};

export default function Home({ data }: PageProps<DinoData[]>) {
  const dinosaurs = Array.isArray(data) ? data : [];
  
  return (
    <main class="p-4 mx-auto max-w-screen-md">
      <h1 class="text-2xl font-bold">Welcome to the Dinosaur app</h1>
      <p class="my-4">Click on a dinosaur below to learn more.</p>
      <ul class="list-disc pl-6">
        {dinosaurs.map((dino) => (
          <li key={dino.name} class="my-2">
            <a 
              href={`/${dino.name.toLowerCase()}`}
              class="text-blue-600 hover:underline"
            >
              {dino.name}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}