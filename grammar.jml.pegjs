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
   = WsNL* statements:TopLevelStatement* WsNL* EOF? {
      return statements
   }

WsNL = [ \t\r\n]+

Ws = [ \t]+

EOF = [^.]

TypeParameterName
   = name:($[a-z]+) {
      return withLoc({ type: 'type-parameter', name: name })
   }

Keyword
   = "fn"

ProperIdentifier
   = $ ([A-Z][A-Za-z0-9_]+)

Identifier
   = $ ([a-z][A-Za-z0-9_]+)

Number
   = value:([0-9]+) {
      return withLoc({
         type: 'number',
         value: value,
      });
   }

String
   = value:($([\"] [^\"]* [\"])) {
      return withLoc({
         type: 'string',
         value: value,
      });
   }

Literal
   = Number
   / String

Application
   = name:Identifier exprs:(WsNL e:Expression { return e; })* {
      return withLoc({
         type: 'application',
         name: name,
         parameters: exprs
      })
   }

ExpressionBase
   = Application
   / Literal

ParenthesizedExpression
   = "(" WsNL? expr:ExpressionBase WsNL? ")" { return expr; }

Expression
   = ExpressionBase
   / ParenthesizedExpression

NameType
   = name:Identifier ":" type:Type {
      return withLoc({ name: name, type: type })
   }

FunctionParameters
   = head:Identifier tail:(Ws n:Identifier { return n }) {
      return [head].concat(tail)
   }

FunctionDeclaration =
   name:Identifier Ws?
   parameters:FunctionParameters? WsNL?
   body:("{" WsNL? e:Expression* WsNL? "}" { return e }) {
      return {
         type: 'function',
         name: name,
         body: body,
         parameters: parameters || [],
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
