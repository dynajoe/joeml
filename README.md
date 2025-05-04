# joeml
A toy programming language inspired by ML.

```
main args { print "Hello World" }
```

## Installation

```bash
npm install
npm run build
```

## CLI Usage

After building the project, you can use the joeml CLI to convert joeml code to JavaScript:

```bash
# Process a file
npm run joeml example.jml

# Process a file with raw (non-beautified) output
npm run joeml -- -r example.jml

# Show help
npm run joeml -- --help
```

## Example

Create a file `hello.jml`:

```
main {
  printLn "Hello, World!"
}
```

Then run:

```bash
npm run joeml hello.jml
```

This will output the generated JavaScript:

```javascript
exports.main = function() {
  const io = {
    stdout: ''
  };

  function print(str) {
    io.stdout += str;
  }

  function printLn(str) {
    io.stdout += str + '\n';
  }

  function main() {
    return printLn("Hello, World!")
  };

  return function() {
    main()
    return io;
  };
}();
```

## Language Features

- Functions with parameters
- Let expressions
- If/else expressions
- Basic arithmetic operators (+, -, *, ==, !=)
- String and number literals
- Tail call optimization

## Example Program

```
foo n {
  n + 1
}

bar n {
  n + 2
}

main {
  foo 1 + bar 2
}
```
