import { parse } from './parser'
import { generate } from './generator'

export function runProgram(input: string) {
   const ast = parse(input)

   const generated = generate(ast)

   const result = eval(`(function () {
      ${generated};
      return main();
   })()`)

   return result
}
