import { createCompilerHost, createProgram, CompilerOptions } from "typescript";

const options: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: false,
};

export default function genDts(inputFileName: string): string {
  let outputText: string;
  const compilerHost = createCompilerHost({});
  compilerHost.writeFile = (name, text) => {
    outputText = text;
  };

  const program = createProgram([ inputFileName ], options, compilerHost);
  program.emit();

  return outputText!;
}
