import { expect } from 'chai'
import { runProgram } from '../src/run'

describe('Hello World', () => {
   it('should produce the correct string', () => {
      const result = runProgram(`main args { print "Hello World" }`)

      expect(result.stdout).to.equal('Hello World')
   })
})
