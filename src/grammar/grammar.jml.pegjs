{
   const onlyOffset = true

   const withLoc = function (value) {
      const loc = location()

      if (onlyOffset) {
         return {...value, location: loc.start.offset }
      }

      return {...value, location: loc }
   }
}

/***
main : Array String -> Int
main args {
   print "hello world"
   0
}
***/
Start
   = statements:(WsNL* s:TopLevelStatement { return s })* WsNL* EOF? {
      return { statements: statements }
   }

WsNL = [ \t\r\n]+

Ws = [ \t]+

EOF = [^.]

TypeParameterName "type parameter"
   = name:($[a-z]+) {
      return withLoc({ type: 'type-parameter', name: name })
   }

Keyword "keyword"
   = ("fn"
   / "let"
   / "in"
   / "record"
   / "union"
   / "if"
   / "else"
   / "then") WsNL

ProperIdentifier "upper identifier"
   = id:([A-Z][A-Za-z0-9_]*) {
      return withLoc({ type: 'upper-identifier', value: id })
   }

Identifier "lower identifier"
   = id:( !(&Keyword) x:($([a-z][A-Za-z0-9_]*)) { return x }) {
      return withLoc({ type: 'lower-identifier', value: id })
   }

Number "number"
   = value:($[0-9]+) {
      return withLoc({
         type: 'number',
         value: value,
      });
   }

String "string"
   = value:($([\"] [^\"]* [\"])) {
      return withLoc({
         type: 'string',
         value: value,
      });
   }

Literal "literal"
   = Number
   / String

/***
let
   foo { print "a" }
in {
   print "hello world"
}
***/
LetExpression "let expression" =
   "let" WsNL
   fns:(fn:FunctionDeclaration WsNL { return fn })+
   "in" WsNL?
   body:FunctionBlock {
      return withLoc({
         type: 'let-expression',
         bindings: fns,
         body: body,
      })
   }

/***
if a == b then
   1
else
   2
***/
IfExpression "if expression" =
   "if" WsNL pred:Expression WsNL
   "then" WsNL t:Expression WsNL
   "else" WsNL f:Expression {
      return {
         type: 'if-expression',
         predicate: pred,
         true_expression: t,
         false_expression: f,
      }
   }

Operand "operand"
   = ParenthesizedExpression
   / LetExpression
   / IfExpression
   / Literal
   / Application

InfixOperator "infix op"
   = op:( "==" / "!=" / "<=" / ">=" / "<" / ">" / "+" / "*" / "-" ) {
      return withLoc({ type: 'lower-identifier', value: op })
   }

CallOrOperand
   = Application
   / Operand

Application
   = name:Identifier operands:(Ws e:Operand { return e; })* {
      return withLoc({
         type: 'application',
         name: name,
         parameters: operands
      })
   }

ParenthesizedExpression
   = "(" WsNL? expr:Expression WsNL? ")" { return expr; }

Expression
   = expr:CallOrOperand rhs:(Ws? i:InfixOperator Ws? r:CallOrOperand { return { r: r, i: i } })* {
      if (rhs.length > 0) {
         return rhs.reverse().reduce((acc, r) => {
            return {
               type: 'application',
               name: r.i,
               parameters: [acc, r.r],
            }
         }, expr)
      } else {
         return expr
      }
   }

NameType
   = name:Identifier ":" type:Type {
      return withLoc({ name: name, type: type })
   }

FunctionParameters
   = head:Identifier tail:(Ws n:Identifier { return n })* {
      return [head].concat(tail)
   }

FunctionBlock "function-block" =
   "{" WsNL?
   body:Expression
   WsNL? "}" {
      return body
   }

FunctionDeclaration =
   name:Identifier
   parameters:(Ws p:FunctionParameters { return p })? WsNL?
   body:FunctionBlock {
      return {
         type: 'function-declaration',
         name: name,
         parameters: parameters || [],
         body: body,
      }
   }

TypeAnnotationList
   = head:Type tail:(Ws? "->" Ws? t:Type { return t })* {
      return [head].concat(tail)
   }

FunctionAnnotation =
  name:Identifier Ws? ":" Ws?
  parameters:TypeAnnotationList

Type
   = name:ProperIdentifier {
      return withLoc({
         type: 'type-name',
         name: name
      })
     }
   / TypeParameterName

UnionMember
   = name:ProperIdentifier parameters:(Ws t:Type { return t })* {
      return withLoc({
         type: 'union-member',
         parameters: parameters,
         name: name,
      })
   }

UnionMemberList
   = ("|" Ws?)? head:UnionMember tail:(WsNL "|" Ws? m:UnionMember { return m })* {
      return [head].concat(tail)
   }

TypeParameterList
   = head:TypeParameterName tail:(Ws p:TypeParameterName { return p })* {
      return [head].concat(tail)
   }

/***
union Foo =
   | Bar
   | Baz
***/
UnionDeclaration =
   "union" Ws name:ProperIdentifier parameters:(Ws p:TypeParameterList { return p })?
   WsNL "=" WsNL members:UnionMemberList {
      return withLoc({
         type: 'union',
         name: name,
         members: members,
      })
   }

// Records

RecordMember =
   name:Identifier Ws? ":" Ws? type:Type {
      return withLoc({ name: name, type: type })
   }

RecordMemberList =
   head:RecordMember
   tail:(WsNL? "," WsNL member:RecordMember { return member })* {
      return [head].concat(tail)
   }

RecordType =
   "{" WsNL members:RecordMemberList WsNL "}" {
      return withLoc({
         type: 'record-type',
         members: members,
      })
   }

/***
record Baz a = { foo : Int, bar : a }
**/
RecordDeclaration =
   "record" Ws name:ProperIdentifier parameters:(Ws p:TypeParameterList { return p })?
   WsNL "=" WsNL record:RecordType {
      return withLoc({
         ...record,
         type: 'record',
         name: name,
         parameters: parameters,
      })
   }


// Statements
TopLevelStatement
   = RecordDeclaration
   / UnionDeclaration
   / FunctionAnnotation
   / FunctionDeclaration
