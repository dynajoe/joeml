import * as T from './types'
import _ from 'lodash'
import beautify from 'js-beautify'
import { parse } from './parser'

const infixFns: { [key: string]: string } = {
   '==': `(a, b) => a === b`,
   '!=': `(a, b) => a !== b`,
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
   return `function () { // let expression
      ${let_expr.bindings.map(b => generateFunction(ctx, b)).join('\n\n')}

      return (${generateExpression({ ...ctx, expect_return: false }, let_expr.body)});
   }()`
}

function makeFunctionCall(ctx: Ctx, fn: T.Application): string {
   if (ctx.fn.name.value === fn.name.value && ctx.fn.parameters.length === fn.parameters.length) {
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
      const parameter_expressions = fn.parameters.map(p => generateExpression({ ...ctx, expect_return: false }, p))
      const parameters = fn.parameters.length === 0 ? '' : `(${parameter_expressions.join(', ')})`

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

function leavesOfType<T extends T.Expression>(t: string, n: T.Expression): T[] {
   let leaves: T[] = []

   if (n.type === 'if-expression') {
      leaves = _.flatMap([n.true_expression, n.false_expression], p => leavesOfType<T>(t, p))
   } else if (n.type === 'let-expression') {
      leaves = leavesOfType<T>(t, n.body)
   } else if (n.type === 'number') {
      leaves = []
   } else if (n.type === 'string') {
      leaves = []
   } else if (n.type === 'application') {
      leaves = []
   } else {
      throw new Error(`Unhandled expression ${JSON.stringify(n)}.`)
   }

   if (!_.isEmpty(leaves)) {
      return leaves
   } else {
      return n.type === t ? [n as T] : []
   }
}

export function generateFunction(ctx: Ctx, fn: T.FunctionDeclaration): string {
   const application_leaves = leavesOfType<T.Application>('application', fn.body)
   const tail_calls = application_leaves.filter(x => x.name.value === fn.name.value)

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
   try {
      const ast = parse(code);
      let jsCode = generate(ast);

      return beautify.js(jsCode, {
         indent_size: 2,
         space_in_empty_paren: true
      });
   } catch (error) {
      return `Error: ${error.message}`;
   }
}