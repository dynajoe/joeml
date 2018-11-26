import * as T from './types'
import * as _ from 'lodash'

const infixFns: { [key: string]: string } = {
   '==': `(a, b) => a === b`,
   '!=': `(a, b) => a !== b`,
   '+': `(a, b) => a + b`,
   '-': `(a, b) => a - b`,
   '*': `(a, b) => a * b`,
}

export interface Ctx {
   indent: number
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

// const indented = (ctx: Ctx, str: string) => {
//    const matches = str.match(/^[ ]+/m)

//    const indentation = new Array(ctx.indent).join(' ')

//    if (matches) {
//       return trimIndentation(str)
//          .split('\n')
//          .join(`\n${indentation}`)
//    } else {
//       return str
//    }
// }

function makeLetExpression(ctx: Ctx, let_expr: T.LetExpression): string {
   return `function () { // let expression
      ${let_expr.bindings.map(b => generateFunction(ctx, b)).join('\n\n')}

      return (${generateExpression(ctx, let_expr.body)});
   }()`
}

function makeFunctionCall(ctx: Ctx, fn: T.Application): string {
   const call_target = _.isNil(infixFns[fn.name.value]) ? fn.name.value : `infix['${fn.name.value}']`

   if (ctx.fn.name.value === fn.name.value && ctx.fn.parameters.length === fn.parameters.length) {
      return `
         ${_.zipWith(
            ctx.fn.parameters,
            fn.parameters,
            (id, expr) => `var $${id.value} = ${generateExpression(ctx, expr)};`
         ).join('\n\n')}

         ${_.map(ctx.fn.parameters, id => `${id.value} = _${id.value};`).join('\n\n')}

         continue ${fn.name.value};
      `
   } else {
      if (fn.parameters.length == 0) {
         return `${call_target}`
      } else {
         return `${call_target}(${fn.parameters.map(p => generateExpression(ctx, p)).join(',')})`
      }
   }
}

export function makeIfExpression(ctx: Ctx, expr: T.IfExpression): string {
   return `
      ${generateExpression(ctx, expr.predicate)}
         ? ${generateExpression(ctx, expr.true_expression)}
         : ${generateExpression(ctx, expr.false_expression)};
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
      return `${expr.value}`
   } else if (expr.type === 'number') {
      return parseInt(expr.value).toString()
   }

   throw new Error('unhandled expression: ' + JSON.stringify(expr, null, 2))
}

function leavesOfType<T>(t: string, n: T.Expression): T[] {
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
      const _exhaustive_check: never = n
      console.log(_exhaustive_check)
   }

   if (!_.isEmpty(leaves)) {
      return leaves
   } else {
      return n.type === t ? [(n as any) as T] : []
   }
}

export function generateFunction(ctx: Ctx, fn: T.FunctionDeclaration): string {
   const new_context = { ...ctx, fn: fn }
   const tail_calls = leavesOfType<T.Application>('application', fn.body).find(x => x.name.value === fn.name.value)

   function makeBody(): string {
      const body = generateExpression(new_context, fn.body)

      if (_.isEmpty(tail_calls)) {
         return body
      }

      return `
      ${fn.name.value}:
      while (true) {
         ${body}
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
