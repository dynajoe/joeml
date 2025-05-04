import * as fs from 'fs';
import { parse } from './parser';
import { generate } from './generator';
import * as beautify from 'js-beautify';

// Function to process joeml code and output generated JavaScript
function processJoemlCode(code: string, options: { beautify?: boolean } = {}): string {
  try {
    // Parse the joeml code
    const ast = parse(code);
    
    // Generate JavaScript from the AST
    let jsCode = generate(ast);
    
    // Beautify the output if requested
    if (options.beautify) {
      jsCode = beautify.js(jsCode, {
        indent_size: 2,
        space_in_empty_paren: true
      });
    }
    
    return jsCode;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// Main function to handle CLI arguments
function main() {
  const args = process.argv.slice(2);
  let code = '';
  let options = { beautify: true };
  
  // Usage information
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
joeml - JavaScript code generator for joeml language

Usage:
  node dist/src/cli.js [options] <file>
  node dist/src/cli.js [options] -e "joeml code"

Options:
  -e, --eval      Evaluate joeml code string
  -r, --raw       Output raw JavaScript (no beautification)
  -h, --help      Show this help
`);
    process.exit(0);
  }
  
  // Process arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-e' || arg === '--eval') {
      if (i + 1 < args.length) {
        code = args[i + 1];
        i++; // Skip the next argument
      } else {
        console.error('Error: No code provided after -e/--eval option');
        process.exit(1);
      }
    } else if (arg === '-r' || arg === '--raw') {
      options.beautify = false;
    } else if (!arg.startsWith('-') && code === '') {
      // If not an option and no code has been set yet, treat as file path
      try {
        code = fs.readFileSync(arg, 'utf8');
      } catch (err) {
        console.error(`Error: Could not read file '${arg}': ${err.message}`);
        process.exit(1);
      }
    }
  }
  
  // If no code was provided, exit
  if (code === '') {
    console.error('Error: No joeml code provided. Use a file path or -e option.');
    process.exit(1);
  }
  
  // Process the code and print the result
  const jsCode = processJoemlCode(code, options);
  console.log(jsCode);
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

// Export for programmatic usage
export { processJoemlCode };