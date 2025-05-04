import { expect } from 'chai'
import { parse } from '../src/parser'
import { generate } from '../src/generator'
import { JMLProgram } from 'src/types'
const Beautify = require('js-beautify')

function runProgram(input: string): [any, JMLProgram, any] {
   const ast = parse(input)

   const generated = Beautify(generate(ast))

   let result = null

   try {
      const eval_string = `(function () {
         const exports = {};

         ${generated};

         return exports.main();
      })();`

      result = eval(eval_string)
   } catch (error) {
      result = { stdout: error.message }
   }

   return [result, ast, generated]
}

describe('Hello World', () => {
   it('should produce the correct string', () => {
      const [result] = runProgram(`main args { print "Hello World" }`)

      expect(result.stdout).to.equal('Hello World')
   })

   it('should be able to evaluate a mathematical expression', () => {
      const [result] = runProgram(`main args { print (1 + 1) }`)

      expect(result.stdout).to.equal('2')
   })

   it('should be able to evaluate the combination of multiple function evaluations', () => {
      const [result] = runProgram(`
         foo { 1 }
         bar { 2 }
         main args { print (bar + foo) }
      `)
      expect(result.stdout).to.equal('3')
   })

   it('allows functions to be declared in let expression', () => {
      const [result] = runProgram(`
         main args {
            let
               foo { 1 }
               bar { 2 }
            in {
               print (bar + foo)
            }
         }
      `)
      expect(result.stdout).to.equal('3')
   })

   it('supports if statements', () => {
      const [result] = runProgram(`
      main args {
         print if 1 == 1 then
            2
         else
            3
      }
      `)

      expect(result.stdout).to.equal('2')
   })

   describe('fib', () => {
      it('should work', () => {
         const [result] = runProgram(`
            fib n {
               if n == 0 then
                  1
               else
                  fib (n - 1) * n
            }

            main args {
               print (fib 5)
            }
         `)

         expect(result.stdout).to.equal('5')
      })

      it('tail recursion', () => {
         const [result] = runProgram(`
            fibHelp n a b {
               if n == 0 then
                  a
               else
                  if n == 1 then
                     b
                  else
                     fibHelp (n - 1) (b) (a + b)
            }

            fib n {
               fibHelp (n) (0) (1)
            }

            main args { print (fib 10) }
         `)

         expect(result.stdout).to.equal('55')
      })
   })
})
