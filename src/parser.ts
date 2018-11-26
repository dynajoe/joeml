import * as T from './types'

export function parse(input: string): T.JMLProgram {
   return loadParser<T.JMLProgram>('joeml')(input)
}

export function loadParser<T>(path: string): T.Parser<T> {
   const parse = require(`../parsers/${path}`).parse

   return (input: string, args: any) => {
      return parse(input, args)
   }
}
