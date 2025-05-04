import * as fs from 'fs';
import { compile } from './generator';

// Main function to handle CLI arguments
function main() {
  const args = process.argv.slice(2);
  let code = '';
  let options = { };
  
  // Usage information
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
joeml - JavaScript code generator for joeml language

Usage:
  node dist/src/cli.js [options] <file>
  node dist/src/cli.js [options] -e "joeml code"

Options:
  -e, --eval      Evaluate joeml code string
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
  
  const jsCode = compile(code, options);
  console.log(jsCode);
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}
