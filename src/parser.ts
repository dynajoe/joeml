import * as T from './types'
import { AST } from './ast'

export function parse(input: string): AST {
   return loadParser<AST>('joeml')(input)
}

export function loadParser<T>(path: string): T.Parser<T> {
   const parse = require(`../parsers/${path}`).parse

   return (input: string, args: any) => {
      return parse(input, args)
   }
}
