# Implementing Type Checking and Records in JoeML

This guide will walk you through implementing type checking and record types in JoeML, explaining the core concepts and design decisions along the way.

## Table of Contents
1. [Understanding Type Systems](#understanding-type-systems)
2. [Type Checker Architecture](#type-checker-architecture)
3. [Implementing Basic Type Checking](#implementing-basic-type-checking)
4. [Adding Record Types](#adding-record-types)
5. [Type Inference](#type-inference)
6. [Error Handling](#error-handling)

## Understanding Type Systems

### Why Add Types?

JoeML currently generates JavaScript without any type checking. Adding types provides:
- **Early error detection**: Catch type mismatches before runtime
- **Better tooling**: Enable autocompletion and refactoring
- **Documentation**: Types serve as inline documentation
- **Optimization opportunities**: Type information can enable better code generation

### Type System Choices

Before implementing, we need to decide on our type system's characteristics:

1. **Static vs Dynamic**: We'll implement static typing (checked at compile-time)
2. **Explicit vs Inferred**: We'll support type inference with optional annotations
3. **Structural vs Nominal**: Records will use structural typing (shape matters, not name)
4. **Gradual vs Strict**: Start strict, can add gradual features later

## Type Checker Architecture

### Core Components

```typescript
// 1. Type Representation
type Type =
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'function', params: Type[], returns: Type }
  | { kind: 'record', fields: { [key: string]: Type } }
  | { kind: 'typevar', id: number }  // For type inference
  | { kind: 'error', message: string };

// 2. Type Environment
type TypeEnv = {
  [name: string]: Type;
};

// 3. Type Checker State
interface TypeCheckerState {
  environment: TypeEnv;
  errors: TypeError[];
  nextTypeVar: number;  // For generating fresh type variables
}
```

### Why This Architecture?

1. **Type representation**: Algebraic data types make pattern matching easy
2. **Environment**: Track variable/function types in scope
3. **Error collection**: Accumulate errors instead of failing fast
4. **Type variables**: Essential for type inference

## Implementing Basic Type Checking

### Step 1: Set Up Type Infrastructure

```typescript
// types.ts
export type Type = 
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'function'; params: Type[]; returns: Type }
  | { kind: 'error'; message: string };

export type TypeEnv = { [name: string]: Type };

// typechecker.ts
export class TypeChecker {
  private env: TypeEnv = {};
  private errors: TypeError[] = [];

  constructor() {
    // Initialize with built-in functions
    this.env = {
      'print': { kind: 'function', params: [{ kind: 'string' }], returns: { kind: 'void' } },
      '+': { kind: 'function', params: [{ kind: 'number' }, { kind: 'number' }], returns: { kind: 'number' } },
      // ... other built-ins
    };
  }
}
```

**Why:** Starting with a minimal type system lets us incrementally add features while ensuring the core works correctly.

### Step 2: Implement Expression Type Checking

```typescript
class TypeChecker {
  checkExpression(expr: Expression, env: TypeEnv): Type {
    switch (expr.type) {
      case 'number':
        return { kind: 'number' };
      
      case 'string':
        return { kind: 'string' };
      
      case 'identifier':
        const type = env[expr.name];
        if (!type) {
          this.errors.push(new TypeError(`Undefined variable: ${expr.name}`));
          return { kind: 'error', message: 'undefined variable' };
        }
        return type;
      
      case 'application':
        const funcType = this.checkExpression(expr.func, env);
        if (funcType.kind !== 'function') {
          this.errors.push(new TypeError(`Cannot call non-function`));
          return { kind: 'error', message: 'not a function' };
        }
        
        // Check argument types match parameters
        const argTypes = expr.args.map(arg => this.checkExpression(arg, env));
        for (let i = 0; i < funcType.params.length; i++) {
          if (!this.typesMatch(argTypes[i], funcType.params[i])) {
            this.errors.push(new TypeError(`Type mismatch in argument ${i + 1}`));
          }
        }
        
        return funcType.returns;
      
      // ... other cases
    }
  }
}
```

**Why:** This bottom-up approach checks subexpressions first, then uses their types to check the whole expression.

### Step 3: Type Checking Functions

```typescript
checkFunction(func: FunctionDeclaration, env: TypeEnv): Type {
  // Create new environment with parameters
  const funcEnv = { ...env };
  const paramTypes: Type[] = [];
  
  for (const param of func.params) {
    // For now, require type annotations on parameters
    const paramType = this.parseTypeAnnotation(param.typeAnnotation);
    paramTypes.push(paramType);
    funcEnv[param.name] = paramType;
  }
  
  // Check function body
  const returnType = this.checkExpression(func.body, funcEnv);
  
  // If function has return type annotation, verify it matches
  if (func.returnType) {
    const declaredReturn = this.parseTypeAnnotation(func.returnType);
    if (!this.typesMatch(returnType, declaredReturn)) {
      this.errors.push(new TypeError(`Function return type mismatch`));
    }
  }
  
  return {
    kind: 'function',
    params: paramTypes,
    returns: returnType
  };
}
```

**Why:** Functions create new scopes, so we extend the environment with parameters before checking the body.

## Adding Record Types

### Step 1: Extend the Type System

```typescript
type Type = 
  // ... existing types
  | { kind: 'record'; fields: { [key: string]: Type } };

// Add record expression type
type Expression =
  // ... existing expressions
  | { type: 'record'; fields: { key: string; value: Expression }[] }
  | { type: 'field-access'; record: Expression; field: string };
```

### Step 2: Record Type Checking

```typescript
checkExpression(expr: Expression, env: TypeEnv): Type {
  switch (expr.type) {
    // ... existing cases
    
    case 'record':
      const fields: { [key: string]: Type } = {};
      for (const field of expr.fields) {
        fields[field.key] = this.checkExpression(field.value, env);
      }
      return { kind: 'record', fields };
    
    case 'field-access':
      const recordType = this.checkExpression(expr.record, env);
      if (recordType.kind !== 'record') {
        this.errors.push(new TypeError(`Cannot access field on non-record type`));
        return { kind: 'error', message: 'not a record' };
      }
      
      const fieldType = recordType.fields[expr.field];
      if (!fieldType) {
        this.errors.push(new TypeError(`Record has no field '${expr.field}'`));
        return { kind: 'error', message: 'field not found' };
      }
      
      return fieldType;
  }
}
```

**Why:** Record typing requires checking that field accesses are valid and tracking field types.

### Step 3: Structural Typing for Records

```typescript
typesMatch(type1: Type, type2: Type): boolean {
  if (type1.kind !== type2.kind) return false;
  
  switch (type1.kind) {
    case 'record':
      if (type2.kind !== 'record') return false;
      
      // Check that all fields in type2 exist in type1 with matching types
      for (const [field, fieldType2] of Object.entries(type2.fields)) {
        const fieldType1 = type1.fields[field];
        if (!fieldType1 || !this.typesMatch(fieldType1, fieldType2)) {
          return false;
        }
      }
      
      // For structural typing, type1 can have extra fields
      return true;
    
    // ... other cases
  }
}
```

**Why:** Structural typing matches types based on shape, not name, making the type system more flexible.

## Type Inference

### Step 1: Add Type Variables

```typescript
type Type =
  // ... existing types
  | { kind: 'typevar'; id: number };

class TypeChecker {
  private nextTypeVar = 0;
  
  freshTypeVar(): Type {
    return { kind: 'typevar', id: this.nextTypeVar++ };
  }
}
```

### Step 2: Constraint Collection

```typescript
type Constraint = {
  type1: Type;
  type2: Type;
  location: SourceLocation;  // For error messages
};

class TypeChecker {
  private constraints: Constraint[] = [];
  
  addConstraint(type1: Type, type2: Type, location: SourceLocation) {
    this.constraints.push({ type1, type2, location });
  }
  
  inferExpression(expr: Expression, env: TypeEnv): Type {
    switch (expr.type) {
      case 'identifier':
        if (!env[expr.name]) {
          // Create a fresh type variable for unknown identifiers
          const typeVar = this.freshTypeVar();
          env[expr.name] = typeVar;
          return typeVar;
        }
        return env[expr.name];
      
      case 'application':
        const funcType = this.inferExpression(expr.func, env);
        const argTypes = expr.args.map(arg => this.inferExpression(arg, env));
        
        // Create a fresh type variable for the result
        const resultType = this.freshTypeVar();
        
        // Add constraint: funcType = (argTypes) -> resultType
        this.addConstraint(funcType, {
          kind: 'function',
          params: argTypes,
          returns: resultType
        }, expr.location);
        
        return resultType;
      
      // ... other cases
    }
  }
}
```

**Why:** Type inference works by collecting constraints on type variables, then solving them.

### Step 3: Unification Algorithm

```typescript
class TypeChecker {
  unify(type1: Type, type2: Type): Type | null {
    if (type1.kind === 'typevar') {
      return this.bindTypeVar(type1.id, type2);
    }
    
    if (type2.kind === 'typevar') {
      return this.bindTypeVar(type2.id, type1);
    }
    
    if (type1.kind !== type2.kind) {
      return null;  // Types don't unify
    }
    
    switch (type1.kind) {
      case 'function':
        if (type2.kind !== 'function') return null;
        
        // Unify parameters and return type
        if (type1.params.length !== type2.params.length) return null;
        
        for (let i = 0; i < type1.params.length; i++) {
          const unifiedParam = this.unify(type1.params[i], type2.params[i]);
          if (!unifiedParam) return null;
        }
        
        const unifiedReturn = this.unify(type1.returns, type2.returns);
        if (!unifiedReturn) return null;
        
        return type1;
      
      // ... other cases
    }
  }
  
  bindTypeVar(id: number, type: Type): Type {
    // Check for circular references (occurs check)
    if (this.occursIn(id, type)) {
      return null;  // Cannot create infinite type
    }
    
    // Update all constraints to replace this type variable
    this.substitute(id, type);
    
    return type;
  }
}
```

**Why:** Unification finds the most general type that satisfies all constraints.

## Error Handling

### Step 1: Create Error Types

```typescript
class TypeError extends Error {
  constructor(
    message: string,
    public location: SourceLocation,
    public type1?: Type,
    public type2?: Type
  ) {
    super(message);
  }
}

class TypeChecker {
  private errors: TypeError[] = [];
  
  get hasErrors(): boolean {
    return this.errors.length > 0;
  }
  
  getErrors(): TypeError[] {
    return [...this.errors];
  }
}
```

### Step 2: User-Friendly Error Messages

```typescript
class TypeChecker {
  private formatType(type: Type): string {
    switch (type.kind) {
      case 'number': return 'Number';
      case 'string': return 'String';
      case 'function':
        const params = type.params.map(p => this.formatType(p)).join(', ');
        const ret = this.formatType(type.returns);
        return `(${params}) -> ${ret}`;
      case 'record':
        const fields = Object.entries(type.fields)
          .map(([k, v]) => `${k}: ${this.formatType(v)}`)
          .join(', ');
        return `{ ${fields} }`;
      case 'typevar':
        return `?${type.id}`;  // Show unresolved type variables
      default:
        return 'Unknown';
    }
  }
  
  reportError(message: string, location: SourceLocation, type1?: Type, type2?: Type) {
    let fullMessage = message;
    
    if (type1 && type2) {
      fullMessage += `\n  Expected: ${this.formatType(type1)}`;
      fullMessage += `\n  Found: ${this.formatType(type2)}`;
    }
    
    this.errors.push(new TypeError(fullMessage, location, type1, type2));
  }
}
```

**Why:** Good error messages help users fix their code quickly.

## Integration with Existing Compiler

### Step 1: Add Type Checking Phase

```typescript
// compiler.ts
class Compiler {
  compile(source: string) {
    // 1. Parse
    const ast = parse(source);
    
    // 2. Type check
    const typeChecker = new TypeChecker();
    const typedAst = typeChecker.check(ast);
    
    if (typeChecker.hasErrors) {
      const errors = typeChecker.getErrors();
      throw new CompilationError('Type errors found', errors);
    }
    
    // 3. Generate code
    return generateJavaScript(typedAst);
  }
}
```

### Step 2: Update AST with Type Information

```typescript
interface TypedExpression extends Expression {
  inferredType?: Type;
}

class TypeChecker {
  check(ast: Program): TypedProgram {
    // Decorate AST nodes with type information
    const typedAst = this.decorateWithTypes(ast);
    
    // Run type checking
    this.checkProgram(typedAst);
    
    return typedAst;
  }
}
```

**Why:** Type-decorated ASTs enable type-driven code generation optimizations.

## Implementation Order

1. **Basic type system**: Start with simple types (number, string)
2. **Function types**: Add function type checking
3. **Type environment**: Implement scoping
4. **Error handling**: Create error reporting system
5. **Record types**: Add structural typing
6. **Type inference**: Implement unification
7. **Integration**: Connect to existing compiler

## Testing Strategy

1. **Unit tests**: Test each type checking component
2. **Integration tests**: Test full programs
3. **Error tests**: Verify error messages
4. **Regression tests**: Prevent reintroduction of bugs

Example test:

```typescript
describe('TypeChecker', () => {
  it('detects type mismatches in function calls', () => {
    const source = `
      function add(x: Number, y: Number): Number {
        return x + y;
      }
      
      add("hello", 42);  // Should error
    `;
    
    const checker = new TypeChecker();
    const result = checker.check(parse(source));
    
    expect(checker.hasErrors).toBe(true);
    expect(checker.getErrors()[0].message).toContain('Type mismatch');
  });
});
```

## Common Pitfalls and Solutions

1. **Circular type references**: Use occurs check in unification
2. **Scope confusion**: Carefully track environment changes
3. **Performance issues**: Cache type checking results
4. **Error explosion**: Implement error recovery
5. **Type variable conflicts**: Use fresh variables

## Advanced Topics for Future Work

1. **Generic types**: Parametric polymorphism
2. **Type aliases**: Named types for better errors
3. **Recursive types**: For tree structures
4. **Gradual typing**: Mix typed and untyped code
5. **Type guards**: Refine types in conditionals

This guide provides a foundation for implementing a type system in JoeML. Start with the basics and incrementally add features as needed.