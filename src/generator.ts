import * as T from './types'
import _ from 'lodash'
import beautify from 'js-beautify'
import { parse } from './parser'

const infixFns: { [key: string]: string } = {
   '==': `(a, b) => a === b`,
   '!=': `(a, b) => a !== b`,
   '<=': `(a, b) => a <= b`,
   '>=': `(a, b) => a >= b`,
   '<': `(a, b) => a < b`,
   '>': `(a, b) => a > b`,
   '+': `(a, b) => a + b`,
   '-': `(a, b) => a - b`,
   '*': `(a, b) => a * b`,
}

export interface Ctx {
   indent: number
   expect_return?: boolean
   fn: T.FunctionDeclaration
}

const wrapProgram = (body: string) => `
exports.main = function () {
   const io = { stdout: '' };

   function print (str) {
      io.stdout += str;
   }

   function printLn (str) {
      io.stdout += str + '\\n';
   }

   ${body};

   return function () {
      main()
      return io;
   };
}();
`

export function trimIndentation(str: string): string {
   const matches = str.match(/^[ ]+/m)

   if (matches) {
      return str.replace(new RegExp(`${matches[0]}`, 'g'), '')
   } else {
      return str
   }
}

function makeLetExpression(ctx: Ctx, let_expr: T.LetExpression): string {
   return `(function () { // let expression
      ${let_expr.bindings.map(b => generateFunction(ctx, b)).join('\n\n')}

      return (${generateExpression({ ...ctx, expect_return: false }, let_expr.body)});
   })()`
}

function makeFunctionCall(ctx: Ctx, fn: T.Application): string {
   // Check if this call is a tail call by looking at all tail calls in the function
   const tail_calls = tailCalls(ctx.fn.name.value, ctx.fn.body)
   const isTailCall = tail_calls.some(tc => tc === fn)
   
   if (ctx.fn.name.value === fn.name.value && 
       ctx.fn.parameters.length === fn.parameters.length && 
       isTailCall) {
      const params = _.zipWith(
         ctx.fn.parameters,
         fn.parameters,
         (id, expr) => `var $$${id.value} = ${generateExpression({ ...ctx, expect_return: false }, expr)};`
      ).join('\n\n')

      return `
         ${params}

         ${_.map(ctx.fn.parameters, id => `${id.value} = $$${id.value};`).join('\n\n')}

         continue ${fn.name.value};
      `
   } else {
      // Check if this is a parameter reference (not a function call)
      if (fn.parameters.length === 0 && ctx.fn && ctx.fn.parameters.some(p => p.value === fn.name.value)) {
         // This is a parameter reference, not a function call
         return `${ctx.expect_return ? 'return' : ''} ${fn.name.value}`
      }
      
      const parameter_expressions = fn.parameters.map(p => generateExpression({ ...ctx, expect_return: false }, p))
      const parameters = `(${parameter_expressions.join(', ')})`

      const function_application = _.isNil(infixFns[fn.name.value])
         ? `${fn.name.value}${parameters}`
         : `${parameter_expressions[0]} ${fn.name.value} ${parameter_expressions[1]}`

      return `${ctx.expect_return ? 'return' : ''} ${function_application}`
   }
}

export function makeIfExpression(ctx: Ctx, expr: T.IfExpression): string {
   if (ctx.expect_return) {
      return `
      if (${generateExpression({ ...ctx, expect_return: false }, expr.predicate)}) {
         ${generateExpression({ ...ctx, expect_return: true }, expr.true_expression)}
      } else {
         ${generateExpression({ ...ctx, expect_return: true }, expr.false_expression)}
      }`
   }

   return `
      ${generateExpression(ctx, expr.predicate)}
         ? ${generateExpression(ctx, expr.true_expression)}
         : ${generateExpression(ctx, expr.false_expression)}
   `
}

export function generateExpression(ctx: Ctx, expr: T.Expression): string {
   if (expr.type === 'application') {
      return makeFunctionCall(ctx, expr)
   } else if (expr.type === 'let-expression') {
      return makeLetExpression(ctx, expr)
   } else if (expr.type === 'if-expression') {
      return makeIfExpression(ctx, expr)
   } else if (expr.type === 'string') {
      return `${ctx.expect_return ? `return ${expr.value};` : expr.value}`
   } else if (expr.type === 'number') {
      return `${ctx.expect_return ? `return ${parseInt(expr.value).toString()};` : parseInt(expr.value).toString()}`
   }

   throw new Error('unhandled expression: ' + JSON.stringify(expr, null, 2))
}

function tailCalls(fnName: string, expr: T.Expression): T.Application[] {
   // A function call is in tail position if it's the last expression executed
   // before returning from the function
   
   if (expr.type === 'application' && expr.name.value === fnName) {
      return [expr]
   } else if (expr.type === 'if-expression') {
      // In an if expression, both branches can contain tail calls
      return [
         ...tailCalls(fnName, expr.true_expression),
         ...tailCalls(fnName, expr.false_expression)
      ]
   } else if (expr.type === 'let-expression') {
      // In a let expression, only the body can contain tail calls
      return tailCalls(fnName, expr.body)
   } else {
      // Other expressions (numbers, strings, non-recursive calls) can't contain tail calls
      return []
   }
}

export function generateFunction(ctx: Ctx, fn: T.FunctionDeclaration): string {
   const tail_calls = tailCalls(fn.name.value, fn.body)

   function makeBody(): string {
      if (_.isEmpty(tail_calls)) {
         return generateExpression({ ...ctx, expect_return: true, fn: fn }, fn.body)
      }

      return `
      ${fn.name.value}:
      while (true) {
         ${generateExpression({ ...ctx, expect_return: true, fn: fn }, fn.body)};
      }`
   }

   return `
      function ${fn.name.value} (${fn.parameters.map(x => x.value).join(', ')}) {
         ${makeBody()}
      }`
}

export function generate(program: T.JMLProgram): string {
   const functions = program.statements.filter(n => n.type === 'function-declaration')

   const ctx: Ctx = { indent: 0, fn: null }

   return wrapProgram(functions.map(f => generateFunction(ctx, f)).join('\n\n'))
}

export function compile(code: string, options: { beautify?: boolean } = {}): string {
   const ast = parse(code);
   let jsCode = generate(ast);

   try {      
      return beautify.js(jsCode, {
         indent_size: 2,
         space_in_empty_paren: true
      });
   } catch (error) {
      return `Error: ${error.message}\n\n${jsCode}`;
   }
}